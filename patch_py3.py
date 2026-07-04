import re

with open('src/components/ClassDetail.tsx', 'r') as f:
    content = f.read()

# I need to split the single points control td into two: Deduct, Add
# Currently it is:
# <td className="py-3 px-4">
#   <div className="flex items-center justify-center gap-1.5 select-none">
#     <button ...> -5 </button>
#     <button ...> -3 </button>
#     <button ...> -1 </button>
#     <button ...> +1 </button>...
#   </div>
# </div>
# </td>

# Replace the <button for +1 to close the div and td, then open new ones
content = re.sub(
    r'<button\s+onClick=\{\(\) => handleUpdatePoints\(student\.id, 1, getActiveReason\(\)\)\}\s+className="([^"]+)"\s*>\s*\+1\s*</button>',
    r'''</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5 select-none">
                              <button
                                onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}
                                className="\1"
                              >
                                +1
                              </button>''',
    content
)

# Replace the closing tags before the Actions column
# After +10 button:
# </button>
# </div>
# </div> <!-- this is the extra div closing that was wrapped around the old points span and buttons -->
# </td>
# <td className="py-3 px-4 text-right">

content = re.sub(
    r'</button>\s*</div>\s*</div>\s*</td>\s*<td className="py-3 px-4 text-right">',
    r'''</button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">''',
    content
)

# Now update styles for buttons:
# -5, -3, -1
content = re.sub(
    r'className="text-xs px-2\.5 py-1\.5 font-mono rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-750 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"',
    r'className="text-xs px-2 py-1.5 font-mono rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"',
    content
)

# +1, +3, +5
content = re.sub(
    r'className="text-xs px-2\.5 py-1\.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400([^"]*) cursor-pointer"',
    r'className="text-xs px-2 py-1.5 font-mono rounded-lg bg-rose-950/40 border border-rose-500/20 hover:bg-rose-500/30 text-rose-400\1 cursor-pointer transition-colors"',
    content
)

# +10
content = re.sub(
    r'className="text-xs px-2\.5 py-1\.5 font-mono rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-white font-bold cursor-pointer"',
    r'className="text-xs px-2 py-1.5 font-mono rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/40 text-white font-bold cursor-pointer transition-colors shadow-[0_0_10px_rgba(225,29,72,0.1)]"',
    content
)

with open('src/components/ClassDetail.tsx', 'w') as f:
    f.write(content)

print("Done")
