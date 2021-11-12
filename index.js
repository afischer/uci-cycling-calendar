const axios = require('axios');
const ics = require('ics')
const fs = require('fs').promises;

// sure hope they use consistent abbrevaitions.. Throw in some extra in case
const MONTH_ABBRS = {
  "Jan": 1,
  'Feb': 2,
  'Mar': 3,
  'Apr': 4,
  'May': 5,
  'June': 6,
  'Jun': 6,
  'July': 7,
  'Jul': 7,
  'Aug': 8,
  'Sept': 9,
  'Sep': 9,
  'Oct': 10,
  'Nov': 11,
  'Dec': 12
}

const EVENT_TYPES = ['road', 'cyclo-cross', 'mountain-bike', 'bmx-freestyle', 'bmx-racing', 'indoor', 'other'];

async function run() {
  const { data } = await axios.get('https://www.uci.org/api/calendar/upcoming');

  // I do not understand how these are nested but events are many levels deep

  const events = data.items.flatMap(group => {
    return group.items.flatMap(({ items }) => items)
  })

  // have a set for deduping - use date + name to check;
  const addedEvents = new Set();
  const icalEvents = [];

  events.forEach(event => {
    const { name, dates, colourCode, venue, country } = event;
    const uniqueId = `${dates} ${name}`
    if (addedEvents.has(uniqueId)) return;

    const yearStr = dates.slice(-4)
    let [startStr, endStr] = dates.split(' - ')
    // add year to end date
    if (!startStr.includes(yearStr)) startStr = `${startStr} ${yearStr}`

    const [startD, startM, startY] = startStr.split(' ');
    const [endD, endM, endY] = (endStr || '').split(' ');
    // if no end date, it's only a one day event

    addedEvents.add(uniqueId)
    icalEvents.push({
      start: [parseInt(startY), MONTH_ABBRS[startM], parseInt(startD)],
      end: endD // if no end date, it's a one day event
        ? [parseInt(endY), MONTH_ABBRS[endM], parseInt(endD)]
        // todo: actually parse these dates like a human being
        : [parseInt(startY), MONTH_ABBRS[startM], parseInt(startD)],
      title: name,
      description: `Event type: ${colourCode}`,
      location: venue ? `${venue}, ${country}` : country,
      categories: [colourCode]
    })
  })

  // create all event calendar
  const { error, value } = ics.createEvents(icalEvents)

  if (error) {
    console.error(error)
    throw new Error(error.message);
  };

  await fs.writeFile('./out/uci-events.ics', value)

  // create specific event type
  EVENT_TYPES.forEach(async (eventType) => {
    const eventsOfType = icalEvents.filter(event => event.categories.includes(eventType));

    const { error, value } = ics.createEvents(eventsOfType)

    if (error) {
      console.error(error)
      throw new Error(error.message);
    };

    await fs.writeFile(`./out/uci-events-${eventType}.ics`, value)
  })
}


try {
  run();
} catch (error) {
  console.error(error)
}

