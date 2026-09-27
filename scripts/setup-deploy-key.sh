#!/bin/bash
set -e

echo "🔐 Setting up SSH deploy key for GitHub Actions..."
echo ""

# Generate SSH key
KEY_FILE="$HOME/.ssh/github-deploy-thehigglers"

if [ -f "$KEY_FILE" ]; then
    echo "❌ Key already exists at $KEY_FILE"
    echo "Delete it first if you want to regenerate: rm $KEY_FILE*"
    exit 1
fi

echo "Generating ed25519 SSH key..."
ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "github-deploy-thehigglers"

echo ""
echo "✅ SSH key generated!"
echo ""
echo "📋 Public key (add to ~/.ssh/authorized_keys on Virtualmin server):"
echo "---"
cat "$KEY_FILE.pub"
echo "---"
echo ""
echo "📋 Private key for GitHub Secret DEPLOY_KEY:"
echo "---"
cat "$KEY_FILE"
echo "---"
echo ""
echo "📝 Instructions:"
echo "1. Copy the public key and add it to your Virtualmin server:"
echo "   ssh user@your-server 'cat >> ~/.ssh/authorized_keys' < $KEY_FILE.pub"
echo ""
echo "2. Copy the private key content"
echo "3. Go to GitHub repo → Settings → Secrets and variables → Actions"
echo "4. Create new secret 'DEPLOY_KEY' and paste the private key"
echo ""
