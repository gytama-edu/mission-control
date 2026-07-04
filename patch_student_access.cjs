const fs = require('fs');
let content = fs.readFileSync('src/components/StudentAccess.tsx', 'utf8');

const target = `    // Private + Points needs 2 extra cards to fill the row (Today's Progress & Recent Progress)
    const showRecentProgressCard = isPrivate && isPointsOnly;

    return (`

const replacement = `    // Private + Points needs 2 extra cards to fill the row (Today's Progress & Recent Progress)
    const showRecentProgressCard = isPrivate && isPointsOnly;

    const sortedTasks = [...tasks].sort((a, b) => {
      // 1. Sort by closed vs active (closed tasks at bottom)
      const isClosedA = a.status === 'closed';
      const isClosedB = b.status === 'closed';
      if (isClosedA !== isClosedB) return isClosedA ? 1 : -1;

      // 2. Sort by submission status priority
      const subA = studentSubmissions[a.id];
      const subB = studentSubmissions[b.id];
      const statusA = getSubmissionStatus(subA);
      const statusB = getSubmissionStatus(subB);

      const getPriority = (status: string) => {
        // Priority 1: Not Submitted or Needs Revision (most actionable)
        if (status === 'Not Submitted' || status === 'Needs Revision') return 1;
        // Priority 2: Submitted / Pending review
        if (status === 'Needs Review' || status === 'Submitted (Late)') return 2;
        // Priority 3: Reviewed / Completed
        if (status === 'Reviewed') return 3;
        return 4;
      };

      const priA = getPriority(statusA);
      const priB = getPriority(statusB);

      if (priA !== priB) {
        return priA - priB;
      }

      // 3. Sort by newest first within the same priority group
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return (`

content = content.replace(target, replacement);

const mapTarget = `{tasks.map((task) => {`
const mapReplacement = `{sortedTasks.map((task) => {`
content = content.replace(mapTarget, mapReplacement);

fs.writeFileSync('src/components/StudentAccess.tsx', content);
console.log("patched successfully");
