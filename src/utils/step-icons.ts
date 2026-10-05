/**
 * Curated step icons for the Goals section. Editors pick one by name in the
 * admin (a `select` sub-field), so SVGs stay in code: crisp, themeable, and no
 * SVG uploads needed (EmDash blocks SVG uploads by default because SVG can
 * carry active content). 24x24 viewBox, drawn with a currentColor stroke.
 *
 * Keep STEP_ICON_NAMES in sync with the `icon` select options in
 * seed/seed.json and seed/seed.prod.json (goals_section.steps).
 */
export const STEP_ICONS = {
	discover: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
	define: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
	design: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>',
	architect: '<path d="M12 3l9 4.5-9 4.5L3 7.5 12 3z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>',
	develop: '<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/><path d="M13.5 5l-3 14"/>',
	build: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>',
	test: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
	uat: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.2c2.4 0 4 1.4 4.5 4"/>',
	preprod: '<rect x="4" y="4" width="16" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.5"/><path d="M8 7.25h.01M8 16.75h.01"/>',
	deploy: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>',
	launch: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
	evolve: '<path d="M20 11a8 8 0 00-14.3-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.3 4.5L20 16"/><path d="M20 20v-4h-4"/>',
	support: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18"/>',
	security: '<path d="M12 3l7.5 3v5.5c0 4.5-3.1 8-7.5 9.5-4.4-1.5-7.5-5-7.5-9.5V6L12 3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
	cloud: '<path d="M7 18.5h10.5a4 4 0 00.5-8 6 6 0 00-11.5 1.2A3.4 3.4 0 007 18.5z"/>',
	data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
	integrate: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
} as const;

export type StepIconName = keyof typeof STEP_ICONS;
export const STEP_ICON_NAMES = Object.keys(STEP_ICONS) as StepIconName[];
export const isStepIcon = (name: unknown): name is StepIconName =>
	typeof name === "string" && name in STEP_ICONS;
