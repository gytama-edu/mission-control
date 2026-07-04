const fs = require('fs');
let content = fs.readFileSync('src/components/StudentAccess.tsx', 'utf8');

const anchor = `const showRecentProgressCard = isPrivate && isPointsOnly;

    return (`;

const replacement = `const showRecentProgressCard = isPrivate && isPointsOnly;

    const sortedTasks = [...tasks].sort((a, b) => {
      const isClosedA = a.status === 'closed';
      const isClosedB = b.status === 'closed';
      if (isClosedA !== isClosedB) return isClosedA ? 1 : -1;

      const subA = studentSubmissions[a.id];
      const subB = studentSubmissions[b.id];
      const statusA = getSubmissionStatus(subA);
      const statusB = getSubmissionStatus(subB);

      const getPriority = (status) => {
        if (status === 'Not Submitted' || status === 'Needs Revision') return 1;
        if (status === 'Needs Review' || status === 'Submitted (Late)') return 2;
        if (status === 'Reviewed') return 3;
        return 4;
      };

      const priA = getPriority(statusA);
      const priB = getPriority(statusB);

      if (priA !== priB) {
        return priA - priB;
      }

      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return (`;

content = content.replace(anchor, replacement);
fs.writeFileSync('src/components/StudentAccess.tsx', content);
