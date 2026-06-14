// Format milliseconds as H:MM:SS or MM:SS
export function formatDuration(ms) {
  if (ms == null || ms < 0) return '--:--'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Diff two ISO timestamp strings -> ms
export function diffMs(start, end) {
  if (!start || !end) return null
  return new Date(end) - new Date(start)
}

// Calculate adult splits from a timing record + race start ISO string
// Stage order: race_start -> swim -> [T1] -> bike_start -> bike -> [T2] -> run_start -> finish
export function calcAdultSplits(record, raceStart) {
  if (!record || !raceStart) return {}
  return {
    swimMs:      diffMs(raceStart,           record.swim_complete),
    t1Ms:        diffMs(record.swim_complete, record.bike_start),
    bikeMs:      diffMs(record.bike_start,    record.bike_complete),
    t2Ms:        diffMs(record.bike_complete, record.run_start),
    runMs:       diffMs(record.run_start,     record.finish_time),
    totalMs:     diffMs(raceStart,            record.finish_time),
  }
}

// Derive adult status label from timing record + whether race has started
export function adultStatus(record, raceStarted) {
  if (!raceStarted) return 'Waiting for Start'
  if (!record) return 'Swimming'
  if (record.dnf) return 'DNF'
  if (record.finish_time)   return 'Finished'
  if (record.run_start)     return 'Running'
  if (record.bike_complete) return 'In T2'
  if (record.bike_start)    return 'Biking'
  if (record.swim_complete) return 'In T1'
  return 'Swimming'
}

// Derive kids status
export function kidsStatus(record, raceStarted) {
  if (!raceStarted) return 'Waiting for Start'
  if (!record) return 'Running'
  if (record.dnf) return 'DNF'
  if (record.finish_time) return 'Finished'
  return 'Running'
}

// Get the next button definition for an adult participant
// Returns { label, field } or null if finished/DNF
export function nextAdultAction(record) {
  if (!record || record.dnf || record.finish_time) return null
  if (!record.swim_complete) return { label: 'Mark Swim Complete', field: 'swim_complete' }
  if (!record.bike_start)    return { label: 'Begin Bike',          field: 'bike_start'    }
  if (!record.bike_complete) return { label: 'Mark Bike Complete',  field: 'bike_complete' }
  if (!record.run_start)     return { label: 'Begin Run',            field: 'run_start'     }
  return                            { label: 'Finish',               field: 'finish_time'   }
}

// Team color pill style
export function teamColorStyle(color) {
  if (!color) return {}
  return {
    background: color,
    color: isLight(color) ? '#111' : '#fff',
    padding: '2px 10px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '0.85rem',
    display: 'inline-block',
  }
}

function isLight(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

export const TEAM_COLORS = [
  { label: 'Red',    value: '#e53e3e' },
  { label: 'Blue',   value: '#3182ce' },
  { label: 'Green',  value: '#38a169' },
  { label: 'Yellow', value: '#d69e2e' },
  { label: 'Purple', value: '#805ad5' },
  { label: 'Orange', value: '#dd6b20' },
  { label: 'Pink',   value: '#d53f8c' },
  { label: 'Grey',   value: '#808080' },
  { label: 'Black',  value: '#1a202c' },
  { label: 'White',  value: '#e2e8f0' },
  { label: 'Brown',  value: '#5e3104' },
]
