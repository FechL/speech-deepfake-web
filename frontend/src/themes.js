// Swatches follow the CSS --accent, --cyan, and --yellow tokens in that order.
export const themes = [
  { id: 'jellybeans', name: 'Jellybeans', mode: 'dark', colors: ['#597bc5', '#71b9f8', '#d8ad4c'] },
  { id: 'horizon', name: 'Horizon', mode: 'dark', colors: ['#e95678', '#25b0bc', '#fab795'] },
  { id: 'everforest', name: 'Everforest', mode: 'dark', colors: ['#a7c080', '#7fbbb3', '#dbbc7f'] },
  { id: 'ayu-dark', name: 'Ayu Dark', mode: 'dark', colors: ['#e6b450', '#59c2ff', '#ff8f40'] },
  { id: 'dracula', name: 'Dracula', mode: 'dark', colors: ['#bd93f9', '#8be9fd', '#f1fa8c'] },
  { id: 'nord', name: 'Nord', mode: 'dark', colors: ['#88c0d0', '#8fbcbb', '#ebcb8b'] },
  { id: 'gruvbox', name: 'Gruvbox Dark', mode: 'dark', colors: ['#83a598', '#8ec07c', '#fabd2f'] },
  { id: 'solarized', name: 'Solarized Dark', mode: 'dark', colors: ['#268bd2', '#2aa198', '#b58900'] },
  { id: 'tokyo-night', name: 'Tokyo Night', mode: 'dark', colors: ['#7aa2f7', '#7dcfff', '#e0af68'] },
  { id: 'catppuccin', name: 'Catppuccin Mocha', mode: 'dark', colors: ['#89b4fa', '#89dceb', '#f9e2af'] },
  { id: 'jellybeans-light', name: 'Jellybeans Light', mode: 'light', colors: ['#4163a8', '#1c689f', '#94650d'] },
  { id: 'solarized-light', name: 'Solarized Light', mode: 'light', colors: ['#226aa5', '#167b75', '#8b6300'] },
  { id: 'nord-light', name: 'Nord Light', mode: 'light', colors: ['#4b7197', '#2b7677', '#825c17'] },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', mode: 'light', colors: ['#1e66f5', '#047b88', '#895900'] },
];

export const defaultTheme = themes[0].id;
export const fonts = [
  { id: 'geist-mono', name: 'Geist Mono' },
  { id: 'inter', name: 'Inter' },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono' },
  { id: 'source-sans-3', name: 'Source Sans 3' },
];
export const defaultFont = fonts[0].id;
export const fontSizes = [
  { value: 90, name: 'Small' },
  { value: 100, name: 'Default' },
  { value: 110, name: 'Large' },
  { value: 120, name: 'Extra large' },
  { value: 130, name: 'Maximum' },
];
export const defaultFontSize = 100;
