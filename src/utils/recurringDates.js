/**
 * Generate recurring event dates based on pattern and end conditions
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @param {string} recurringType - 'daily', 'weekly', 'biweekly', 'monthly'
 * @param {number[]} recurringDays - Array of day numbers (0-6, Sunday=0) for weekly/biweekly
 * @param {string} recurringEndType - 'occurrences', 'date', 'never'
 * @param {number} recurringOccurrences - Number of occurrences (if recurringEndType is 'occurrences')
 * @param {string} recurringEndDate - End date in YYYY-MM-DD format (if recurringEndType is 'date')
 * @returns {Date[]} Array of Date objects for recurring events
 */
export function generateRecurringDates(
  startDate,
  startTime,
  endTime,
  recurringType,
  recurringDays = [],
  recurringEndType = 'occurrences',
  recurringOccurrences = 4,
  recurringEndDate = null
) {
  const dates = [];
  const start = new Date(`${startDate}T${startTime}:00`);
  const maxEvents = 52; // Maximum events allowed
  
  let currentDate = new Date(start);
  let eventCount = 0;

  // Helper to add date to array
  const addDate = (date) => {
    if (!dates.find(d => d.getTime() === date.getTime())) {
      dates.push(new Date(date));
      eventCount++;
    }
  };

  // Check end conditions
  const shouldStop = () => {
    if (eventCount >= maxEvents) return true;
    if (recurringEndType === 'occurrences' && eventCount >= recurringOccurrences) return true;
    if (recurringEndType === 'date' && recurringEndDate) {
      const endDate = new Date(recurringEndDate + 'T23:59:59');
      if (currentDate > endDate) return true;
    }
    return false;
  };

  // Add first date
  addDate(start);

  if (recurringType === 'daily') {
    while (!shouldStop() && eventCount < maxEvents) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (!shouldStop()) {
        addDate(currentDate);
      }
    }
  } else if (recurringType === 'weekly' || recurringType === 'biweekly') {
    const weekIncrement = recurringType === 'biweekly' ? 2 : 1;
    
    if (recurringDays.length > 0) {
      // For specific days of week
      let weekOffset = 0;
      while (!shouldStop() && weekOffset < 52) {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (weekOffset * 7 * weekIncrement));
        
        for (const dayOfWeek of recurringDays) {
          const targetDate = new Date(weekStart);
          const currentDay = targetDate.getDay();
          const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
          targetDate.setDate(targetDate.getDate() + daysToAdd + (weekOffset * 7 * weekIncrement));
          
          // Only add if it's on or after start date
          if (targetDate >= start) {
            if (recurringEndType === 'date' && recurringEndDate && targetDate > new Date(recurringEndDate + 'T23:59:59')) {
              return dates.sort((a, b) => a - b);
            }
            addDate(targetDate);
            if (shouldStop()) return dates.sort((a, b) => a - b);
          }
        }
        weekOffset++;
      }
    } else {
      // Same day of week each week/biweek
      while (!shouldStop() && eventCount < maxEvents) {
        currentDate.setDate(currentDate.getDate() + (7 * weekIncrement));
        if (!shouldStop()) {
          addDate(currentDate);
        }
      }
    }
  } else if (recurringType === 'monthly') {
    while (!shouldStop() && eventCount < maxEvents) {
      currentDate.setMonth(currentDate.getMonth() + 1);
      if (!shouldStop()) {
        addDate(currentDate);
      }
    }
  }

  // Sort and return unique dates
  return [...new Set(dates.map(d => d.getTime()))]
    .map(time => new Date(time))
    .sort((a, b) => a - b)
    .slice(0, maxEvents);
}
