@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-mc-bg-main: #030712;
  --color-mc-bg-panel: #0b0f19;
  --color-mc-bg-card: #111827;
  --color-mc-accent: #f43f5e;
  --color-mc-accent-glow: rgba(244, 63, 94, 0.15);
  --color-mc-cyan: #06b6d4;
}

body {
  @apply bg-slate-950 text-slate-100 font-sans antialiased min-h-screen selection:bg-rose-500/30 selection:text-white;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(244, 63, 94, 0.04) 0%, transparent 45%),
    radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.03) 0%, transparent 45%);
  background-attachment: fixed;
}

/* Premium Custom Scrollbars */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.3);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(244, 63, 94, 0.2);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(244, 63, 94, 0.4);
}

/* Suggested Reusable UI classes */
.mc-shell {
  @apply min-h-screen flex flex-col bg-slate-950 text-slate-100;
}

.mc-page {
  @apply max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1;
}

.mc-header {
  @apply flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 mb-8 border-b border-slate-900;
}

.mc-brand {
  @apply flex items-center gap-3 select-none;
}

.mc-brand-title {
  @apply font-display font-bold text-xl sm:text-2xl tracking-tight text-white flex items-center gap-2;
}

.mc-brand-subtitle {
  @apply text-xs font-mono uppercase tracking-widest text-rose-500;
}

.mc-card {
  @apply bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-slate-700/60;
}

.mc-card-header {
  @apply flex justify-between items-start gap-4 mb-4 pb-4 border-b border-slate-800/50;
}

.mc-card-title {
  @apply font-display font-semibold text-lg text-white;
}

.mc-card-meta {
  @apply text-xs font-mono text-slate-500 uppercase tracking-wider;
}

/* Grouped button rules to prevent apply recursion errors */
.mc-button, .mc-button-primary, .mc-button-secondary, .mc-button-danger {
  @apply inline-flex items-center justify-center gap-2 font-display font-medium rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none;
}

.mc-button-primary {
  @apply px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-[0.98] border border-rose-500/30;
}

.mc-button-secondary {
  @apply px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white active:scale-[0.98];
}

.mc-button-danger {
  @apply px-5 py-2.5 bg-red-950/40 hover:bg-red-900/40 text-red-200 border border-red-900/50 active:scale-[0.98];
}

/* Grouped status-pill rules */
.mc-status-pill, .mc-status-pill-purple, .mc-status-pill-emerald, .mc-status-pill-rose, .mc-status-pill-amber {
  @apply inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border uppercase tracking-wider;
}

.mc-status-pill-purple {
  @apply bg-purple-950/40 text-purple-300 border-purple-800/50;
}

.mc-status-pill-emerald {
  @apply bg-emerald-950/40 text-emerald-300 border-emerald-800/50;
}

.mc-status-pill-rose {
  @apply bg-rose-950/40 text-rose-300 border-rose-800/50;
}

.mc-status-pill-amber {
  @apply bg-amber-950/40 text-amber-300 border-amber-800/50;
}

.mc-empty-state {
  @apply flex flex-col items-center justify-center text-center py-12 px-4 bg-slate-900/40 border border-dashed border-slate-800/80 rounded-2xl;
}

.mc-modal {
  @apply fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm;
}

.mc-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6;
}

/* Premium Compact Back Link Styles */
.mc-back-link {
  @apply inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-all duration-200 cursor-pointer bg-slate-900/40 hover:bg-slate-900/75 border border-slate-800/80 hover:border-slate-700/60 rounded-lg px-2.5 py-1.5 shadow-sm select-none w-fit focus:outline-none focus:ring-1 focus:ring-rose-500/30;
}

.mc-back-link:hover .mc-back-icon {
  transform: translateX(-2px);
}

.mc-back-icon {
  @apply text-slate-400 transition-all duration-200 shrink-0;
}

.mc-breadcrumb {
  @apply flex items-center gap-2 text-xs text-slate-500 font-medium select-none;
}

.mc-page-nav {
  @apply flex items-center justify-between w-full mb-4 select-none;
}

