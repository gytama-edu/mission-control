const fs = require('fs');

let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const targetLabel = '<label className="block text-[11px] text-slate-400 font-medium">Feedback / Evaluation comments</label>';

const replacementLabel = `<div className="flex items-center justify-between mb-1.5">
                                          <label className="block text-[11px] text-slate-400 font-medium">Feedback / Evaluation comments</label>
                                          <button
                                            type="button"
                                            disabled
                                            className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded flex items-center gap-1 opacity-60 cursor-not-allowed"
                                            title="AI Feedback (Coming Soon)"
                                          >
                                            <Sparkles size={10} />
                                            AI Draft
                                          </button>
                                        </div>`;

if (code.includes(targetLabel)) {
  code = code.replace(targetLabel, replacementLabel);
  // Also need to import Sparkles if not already imported
  if (!code.includes('Sparkles')) {
    code = code.replace('import { ', 'import { Sparkles, ');
  }
  fs.writeFileSync('src/components/ClassDetail.tsx', code);
  console.log('ClassDetail.tsx patched');
} else {
  console.log('Target label not found');
}
