#!/bin/bash
set -e

echo "🚀 Setting up Virtualmin server for The Higglers deployment..."

# Check if running with sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run with sudo"
   exit 1
fi

# Variables
APP_NAME="thehigglers"
APP_PATH="/var/www/$APP_NAME"
DB_USER="${APP_NAME}_app"
DB_NAME="$APP_NAME"
DB_PORT="5432"
DEPLOY_USER="${SUDO_USER:-www-data}"

echo "📦 Installing dependencies..."

# Install Node.js (if not already installed)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs rsync
else
    echo "✅ Node.js already installed: $(node --version)"
    apt-get install -y rsync
fi

# Install pnpm and PM2
echo "Installing pnpm and PM2..."
npm install -g pnpm pm2

echo "📁 Creating application directory..."
mkdir -p "$APP_PATH/uploads"
mkdir -p "$APP_PATH/node_modules"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_PATH"
chmod 755 "$APP_PATH/uploads"

echo "🐘 Configuring PostgreSQL..."
read -sp "Enter PostgreSQL password for $DB_USER: " DB_PASSWORD
echo ""

sudo -u postgres psql << SQL
DO \$\$
BEGIN
  -- Check if database exists
  IF NOT EXISTS (
    SELECT FROM pg_database WHERE datname = '$DB_NAME'
  ) THEN
    CREATE DATABASE $DB_NAME;
  END IF;
END
\$\$;

-- Create role if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = '$DB_USER'
  ) THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

-- Grant privileges
ALTER ROLE $DB_USER SET client_encoding TO 'utf8';
ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';
ALTER ROLE $DB_USER SET default_transaction_deferrable TO on;
ALTER ROLE $DB_USER SET default_time_zone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "📝 Save this connection string for GitHub Secrets (PROD_DATABASE_URL):"
echo "postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
echo ""

echo "📝 Creating .env file..."
cat > "$APP_PATH/.env" << ENV_FILE
NODE_ENV=production
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME
UPLOADS_DIR=$APP_PATH/uploads
ENV_FILE

chmod 600 "$APP_PATH/.env"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_PATH/.env"

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add your SSH deploy key to ~/.ssh/authorized_keys"
echo "2. Set up GitHub Secrets in your repository:"
echo "   - DEPLOY_KEY: SSH private key content"
echo "   - DEPLOY_HOST: $(hostname -f)"
echo "   - DEPLOY_USER: $DEPLOY_USER"
echo "   - DEPLOY_PATH: $APP_PATH"
echo "   - PROD_DATABASE_URL: postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
echo "3. Install production dependencies: cd $APP_PATH && pnpm install --frozen-lockfile --prod"
echo "4. Configure nginx/apache reverse proxy to port 3000"
echo "5. Push to master branch to trigger deployment"
