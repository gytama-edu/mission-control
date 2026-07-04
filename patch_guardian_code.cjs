const fs = require('fs');

// 1. Add generateGuardianCode to classroomUtils
let utils = fs.readFileSync('src/utils/classroomUtils.ts', 'utf8');
utils += `

export function generateGuardianCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
`;
fs.writeFileSync('src/utils/classroomUtils.ts', utils);

// 2. Modify addStudent in missionControlData to include guardian_access_code
let dataFile = fs.readFileSync('src/services/missionControlData.ts', 'utf8');

const importTarget = `import { supabase } from '../lib/supabaseClient';`;
if (dataFile.includes(importTarget)) {
  dataFile = dataFile.replace(importTarget, importTarget + `\nimport { generateGuardianCode } from '../utils/classroomUtils';`);
} else {
  // Try to find the top of the file
  dataFile = `import { generateGuardianCode } from '../utils/classroomUtils';\n` + dataFile;
}

const addStudentTarget = `      name,
      pin,
      lives: maxLives,
      points: initialPoints`;
const addStudentReplacement = `      name,
      pin,
      lives: maxLives,
      points: initialPoints,
      guardian_access_code: generateGuardianCode()`;
dataFile = dataFile.replace(addStudentTarget, addStudentReplacement);

// 3. Add updateGuardianCode function
dataFile += `
export const updateGuardianCode = async (studentId: string): Promise<string> => {
  const newCode = generateGuardianCode();
  const { error } = await supabase
    .from('students')
    .update({ guardian_access_code: newCode })
    .eq('id', studentId);

  if (error) throw error;
  return newCode;
};
`;

// 4. Add guardian fetch safe function
dataFile += `
export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
  // Fetch class id
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id, name, category, scoring_system')
    .eq('class_code', classCode)
    .single();

  if (classError || !classData) {
    return { ok: false, reason: 'invalid_code' };
  }

  // Fetch student using guardian code and class_id
  const { data: studentData, error: studentError } = await supabase
    .from('students')
    .select('id, name, nickname, points, lives')
    .eq('class_id', classData.id)
    .eq('guardian_access_code', guardianCode)
    .single();

  if (studentError || !studentData) {
    return { ok: false, reason: 'invalid_code' };
  }
  
  // Return minimal safe info
  return {
    ok: true,
    classData,
    studentData
  };
};
`;

fs.writeFileSync('src/services/missionControlData.ts', dataFile);
