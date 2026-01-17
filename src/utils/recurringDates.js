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

  while (eventCount < maxEvents) {
    // Check end conditions
    if (recurringEndType === 'occurrences' && eventCount >= recurringOccurrences) {
      break;
    }
    
    if (recurringEndType === 'date' && recurringEndDate) {
      const endDate = new Date(recurringEndDate + 'T23:59:59');
      if (currentDate > endDate) {
        break;
      }
    }

    // Add date based on recurring type
    if (recurringType === 'daily') {
      if (eventCount === 0 || !dates.length || currentDate >= start) {
        dates.push(new Date(currentDate));
        eventCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (recurringType === 'weekly' || recurringType === 'biweekly') {
      const weekIncrement = recurringType === 'biweekly' ? 2 : 1;
      
      if (recurringDays.length > 0) {
        // Find next occurrence on specified days
        let found = false;
        for (let weekOffset = 0; weekOffset < 52 && !found; weekOffset++) {
          const checkDate = new Date(start);
          checkDate.setDate(checkDate.getDate() + (weekOffset * 7 * weekIncrement));
          
          for (const dayOfWeek of recurringDays) {
            const targetDate = new Date(checkDate);
            const currentDay = targetDate.getDay();
            const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
            targetDate.setDate(targetDate.getDate() + daysToAdd + (weekOffset * 7 * weekIncrement));
            
            if (targetDate >= start && !dates.find(d => d.getTime() === targetDate.getTime())) {
              if (recurringEndType === 'date' && recurringEndDate && targetDate > new Date(recurringEndDate + 'T23:59:59')) {
                found = true;
                break;
              }
              if (recurringEndType === 'occurrences' && eventCount >= recurringOccurrences) {
                found = true;
                break;
              }
              dates.push(new Date(targetDate));
              eventCount++;
              if (eventCount >= maxEvents) {
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
        
        // If we have enough dates, break
        if (recurringEndType === 'occurrences' && eventCount >= recurringOccurrences) {
          break;
        }
        if (recurringEndType === 'date' && recurringEndDate && currentDate > new Date(recurringEndDate + 'T23:59:59')) {
          break;
        }
        
        // Move to next week/biweek
        currentDate.setDate(currentDate.getDate() + (7 * weekIncrement));
      } else {
        // No specific days, use start date's day of week
        if (eventCount === 0) {
          dates.push(new Date(start));
          eventCount++;
        }
        currentDate.setDate(currentDate.getDate() + (7 * weekIncrement));
        if (currentDate >= start || eventCount > 0) {
          if (recurringEndType === 'date' && recurringEndDate && currentDate > new Date(recurringEndDate + 'T23:59:59')) {
            break;
          }
          if (recurringEndType === 'occurrences' && eventCount >= recurringOccurrences) {
            break;
          }
          dates.push(new Date(currentDate));
          eventCount++;
        }
      }
    } else if (recurringType === 'monthly') {
      if (eventCount === 0) {
        dates.push(new Date(start));
        eventCount++;
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
      if (recurringEndType === 'date' && recurringEndDate && currentDate > new Date(recurringEndDate + 'T23:59:59')) {
        break;
      }
      if (recurringEndType === 'occurrences' && eventCount >= recurringOccurrences) {
        break;
      }
      dates.push(new Date(currentDate));
      eventCount++;
    }

    // Safety break to prevent infinite loops
    if (eventCount >= maxEvents) {
      break;
    }
  }

  // Sort dates and remove duplicates
  const uniqueDates = [...new Set(dates.map(d => d.getTime()))]
    .map(time => new Date(time))
    .sort((a, b) => a - b)
    .slice(0, maxEvents);

  return uniqueDates;
}
