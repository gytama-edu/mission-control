const fs = require('fs');
let code = fs.readFileSync('src/components/StudentAccess.tsx', 'utf8');

const replacement = `    } catch (err: any) {
      if (!isAutoSync) {
        setError(err.message || 'Failed to connect.');
      } else {
        console.error("Auto-sync failed:", err);
      }
    } finally {
      if (!isAutoSync) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboardDataRef.current = fetchDashboardData;
  });

  // Safe Auto-Sync & Visibility Refresh
  useEffect(() => {
    if (!loggedInClass || !loggedInStudent) return;
    
    let isVisible = document.visibilityState === 'visible';
    let isSyncing = false;
    const classId = loggedInClass.id;
    const studentId = loggedInStudent.id;

    const performAutoSync = async () => {
      if (!isVisible || isSyncing || !fetchDashboardDataRef.current) return;
      
      const saved = window.localStorage.getItem(PROFILE_KEY);
      const savedPin = saved ? JSON.parse(saved).pin : pin;
      if (!savedPin) return;

      isSyncing = true;
      try {
        await fetchDashboardDataRef.current(classId, studentId, savedPin, true);
      } finally {
        isSyncing = false;
      }
    };

    // 1. Polling interval (every 60 seconds)
    const intervalId = setInterval(performAutoSync, 60000);

    // 2. Visibility change listener (refresh when tab becomes visible)
    const handleVisibilityChange = () => {
      const currentlyVisible = document.visibilityState === 'visible';
      if (currentlyVisible && !isVisible) {
        performAutoSync();
      }
      isVisible = currentlyVisible;
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loggedInClass?.id, loggedInStudent?.id]);`;

const patternStart = "    } catch (err: any) {";
const patternEnd = "  }, [loggedInClass?.id, loggedInStudent?.id]);";

const startIndex = code.indexOf(patternStart, code.indexOf("fetchDashboardData ="));
const endIndex = code.indexOf(patternEnd, startIndex) + patternEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
    fs.writeFileSync('src/components/StudentAccess.tsx', code);
    console.log("Success");
} else {
    console.log("Failed to find pattern");
}
