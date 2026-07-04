const fs = require('fs');
let content = fs.readFileSync('src/services/missionControlData.ts', 'utf8');

const target = `export const updateGuardianCode = async (studentId: string): Promise<string> => {
  const newCode = generateGuardianCode();
  const { error } = await supabase
    .from('students')
    .update({ guardian_access_code: newCode })
    .eq('id', studentId);

  if (error) throw error;
  return newCode;
};`;

const replacement = `export const updateGuardianCode = async (studentId: string): Promise<string> => {
  console.log('Generating code for student ID exists:', !!studentId);
  const newCode = generateGuardianCode();
  console.log('Generated code exists:', !!newCode);
  
  const { error } = await supabase
    .from('students')
    .update({ guardian_access_code: newCode })
    .eq('id', studentId);

  if (error) {
    console.error('Update failure message:', error.message || error);
    throw error;
  }
  
  console.log('Update success message: Guardian code generated successfully.');
  return newCode;
};`;

content = content.replace(target, replacement);
fs.writeFileSync('src/services/missionControlData.ts', content);
