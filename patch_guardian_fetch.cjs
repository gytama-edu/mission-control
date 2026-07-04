const fs = require('fs');
let content = fs.readFileSync('src/services/missionControlData.ts', 'utf8');

const target = `export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
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

const replacement = `export const fetchGuardianStudentPreview = async (classCode: string, guardianCode: string): Promise<any> => {
  const normalizedClassCode = classCode.trim().toUpperCase();
  const normalizedGuardianCode = guardianCode.trim().toUpperCase();
  
  console.log(\`[Guardian Login] Attempting login. Class Code length: \${normalizedClassCode.length}, Guardian Code length: \${normalizedGuardianCode.length}\`);

  const { data, error } = await supabase.rpc('guardian_fetch_dashboard_data', {
    p_class_code: normalizedClassCode,
    p_guardian_code: normalizedGuardianCode
  });

  if (error) {
    console.error('[Guardian Login] RPC error:', error.message || error);
    return { ok: false, reason: 'error' };
  }
  
  if (data?.ok) {
    console.log('[Guardian Login] Success: class and student found.');
  } else {
    console.log('[Guardian Login] Failed: student or class not found.');
  }
  
  return data;
};`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/services/missionControlData.ts', content);
  console.log("Patched fetchGuardianStudentPreview successfully.");
} else {
  console.log("Target not found!");
}
