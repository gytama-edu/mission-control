const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const tableHeadersOld = `                              <th className="p-4 text-center">Actions</th>
                              <th className="p-4 text-center">Points</th>`;

const tableHeadersNew = `                              <th className="p-4 text-center">Actions</th>
                              <th className="p-4 text-center">Points</th>
                              <th className="p-4 text-center hidden md:table-cell">Submissions</th>
                              <th className="p-4 text-center hidden md:table-cell">Reviews</th>`;

if (code.includes(tableHeadersOld)) {
    code = code.replace(tableHeadersOld, tableHeadersNew);
}

const tableStatsOld = `                              const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
                              
                              const totalLivesLost = logsForMeeting.filter(l => l.lives_delta && l.lives_delta < 0).reduce((sum, l) => sum + Math.abs(l.lives_delta || 0), 0);
                              const totalLivesGained = logsForMeeting.filter(l => l.lives_delta && l.lives_delta > 0).reduce((sum, l) => sum + (l.lives_delta || 0), 0);
                              
                              return (`;

const tableStatsNew = `                              const totalPoints = logsForMeeting.filter(l => l.points_delta).reduce((sum, l) => sum + (l.points_delta || 0), 0);
                              
                              const endTimestamp = meeting.endedAt ? new Date(meeting.endedAt).getTime() : new Date().getTime();
                              const submissionsDuring = allSubmissions.filter(s => {
                                const t = new Date(s.created_at).getTime();
                                return t >= startDate.getTime() && t <= endTimestamp;
                              }).length;
                              const reviewsDuring = allSubmissions.filter(s => {
                                if (!s.reviewed_at) return false;
                                const t = new Date(s.reviewed_at).getTime();
                                return t >= startDate.getTime() && t <= endTimestamp;
                              }).length;

                              const totalLivesLost = logsForMeeting.filter(l => l.lives_delta && l.lives_delta < 0).reduce((sum, l) => sum + Math.abs(l.lives_delta || 0), 0);
                              const totalLivesGained = logsForMeeting.filter(l => l.lives_delta && l.lives_delta > 0).reduce((sum, l) => sum + (l.lives_delta || 0), 0);
                              
                              return (`;

if (code.includes(tableStatsOld)) {
    code = code.replace(tableStatsOld, tableStatsNew);
}

const tableCellsOld = `                                  <td className="p-4 text-center font-mono text-sm text-purple-400">{totalActions}</td>
                                  <td className="p-4 text-center font-mono text-sm text-rose-400 font-semibold">
                                    {totalPoints >= 0 ? \`+\${totalPoints}\` : totalPoints}
                                  </td>`;

const tableCellsNew = `                                  <td className="p-4 text-center font-mono text-sm text-purple-400">{totalActions}</td>
                                  <td className="p-4 text-center font-mono text-sm text-rose-400 font-semibold">
                                    {totalPoints >= 0 ? \`+\${totalPoints}\` : totalPoints}
                                  </td>
                                  <td className="p-4 text-center font-mono text-sm text-blue-400 hidden md:table-cell">{submissionsDuring}</td>
                                  <td className="p-4 text-center font-mono text-sm text-indigo-400 hidden md:table-cell">{reviewsDuring}</td>`;

if (code.includes(tableCellsOld)) {
    code = code.replace(tableCellsOld, tableCellsNew);
}

fs.writeFileSync('src/components/ClassDetail.tsx', code);
console.log("Success");
