const fs = require('fs');
let content = fs.readFileSync('src/services/missionControlData.ts', 'utf8');

const targetFunc = `export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
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

const replacementFunc = `export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
  const { data, error } = await supabase.rpc('guardian_fetch_dashboard_data', {
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
