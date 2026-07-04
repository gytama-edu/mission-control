const fs = require('fs');
let content = fs.readFileSync('src/services/missionControlData.ts', 'utf8');

const targetFunc = `export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
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
};`;

const replacementFunc = `export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
  const { data, error } = await supabase.rpc('guardian_verify_access', {
    p_class_code: classCode,
    p_guardian_code: guardianCode
  });

  if (error) {
    console.error(error);
    return { ok: false, reason: 'error' };
  }
  
  return data;
};`;

if (content.includes(targetFunc)) {
  content = content.replace(targetFunc, replacementFunc);
}

fs.writeFileSync('src/services/missionControlData.ts', content);
