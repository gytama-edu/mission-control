const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

code = code.replace(
  '<th className="py-2.5 px-4 font-semibold text-center w-64">Points Control</th>',
  `<th className="py-2.5 px-4 font-semibold text-center w-24">Points</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-36">Deduct</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-48">Add</th>`
);

const oldBodyStart = `<td className="py-2 px-4">
                            <div className="flex items-center justify-center gap-3 select-none">
                              <span className="font-mono font-bold text-white text-sm w-10 text-right pr-2 border-r border-slate-800">
                                {student.points}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 justify-center">`;

const newBodyStart = `<td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-white text-base">
                              {student.points}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5 select-none">`;

if (code.includes(oldBodyStart)) {
  code = code.replace(oldBodyStart, newBodyStart);
  
  // Replace the +1 button start to split the div
  const plusOneButton = `<button
                                   onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}`;
  const splitDiv = `</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5 select-none">
                              <button
                                 onClick={() => handleUpdatePoints(student.id, 1, getActiveReason())}`;
  code = code.replace(plusOneButton, splitDiv);

  fs.writeFileSync('src/components/ClassDetail.tsx', code);
  console.log('Roster table patched successfully (step 1).');
} else {
  console.log('Error: Could not find oldBodyStart');
}

// Now replace remaining td closing and actions
