'use client';

import { useEffect, useState, useRef } from 'react';

const spawnInterval = 20;
const spawnLocations = [
  { chest: 'Orc Village', ore: 'Sealed Sanctuary' },
  { chest: 'Sealed Sanctuary', ore: 'Shrine of Devotion' },
  { chest: 'Shrine of Devotion', ore: 'Arkeum Post' },
  { chest: 'Arkeum Post', ore: 'Orc Village' }
];

// Known info: On April 10th, 2025, at midnight, the chest spawn was at Sealed Sanctuary.
const baseTime = new Date('2025-04-10T04:00:00Z'); // April 10th, Midnight EDT (UTC-4)
const baseAnchorIndex = 1;

function isSkippedTime(date) {
  // Create a formatter that outputs parts in Eastern Time.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    weekday: 'short', // e.g., "Sun", "Mon", etc.
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const hourPart = parts.find(part => part.type === 'hour');
  const hour = parseInt(hourPart.value, 10);

  return hour === 22;
}

function getNextSpawnTime() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCSeconds(0);
  next.setUTCMilliseconds(0);
  const minutes = now.getUTCMinutes();
  const increment = spawnInterval - (minutes % spawnInterval);
  next.setUTCMinutes(minutes + increment);

  while (isSkippedTime(next)) {
    next.setUTCMinutes(next.setUTCMinutes() + spawnInterval);
  }

  return next;
}

function getNextSpawnLocation() {
  const now = new Date();
  const next = getNextSpawnTime();
  let offset = next.getUTCHours() - now.getUTCHours();
  if (next.getUTCDate() !== now.getUTCDate()) {
    offset += 24; // Add 24 hours if `next` is on the next day
  }  
  return getSpawn(offset);
}

/**
 * Modulus function that handles negative numbers correctly.
 * @param {number} a - The dividend.
 * @param {number} b - The divisor.
 */
function arithmeticMod(a, b) {
  return ((a % b) + b) % b;
}

/**
 * Counts the number of extra re-anchor events from `fromTime` (inclusive) up to `toTime` (inclusive).
 * An extra re-anchor event occurs each time the local Eastern time is Thursday and the clock has 
 * passed 4:00 AM. This iteration goes day by day from the base time.
 *
 * @param {Date} fromTime - The starting time (typically baseTime).
 * @param {Date} toTime - The projected spawn time.
 * @returns {number} - The total extra re-anchor count.
 */
function countExtraThursdayAnchors(fromTime, toTime) {
  let count = 0;
  const msInDay = 24 * 60 * 60 * 1000;
  // Total whole days between the two times.
  const totalDays = Math.floor((toTime - fromTime) / msInDay);

  // Iterate for each day offset from 0 to totalDays.
  // (Day 0 corresponds to baseTime's day; if the projected time on that day is past 4am and that day is Thursday, count it.)
  for (let d = 0; d <= totalDays; d++) {
    // Calculate the extra anchor event time: 4 AM local Eastern on day 'd'
    const eventTime = new Date(fromTime.getTime() + d * msInDay + 4 * 60 * 60 * 1000);
    // Only count the event if the projected spawn time is on or after the event
    if (toTime >= eventTime) {
      // Get the weekday of the event time in Eastern Time.
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        hour12: false,
      });
      const parts = dtf.formatToParts(eventTime);
      const weekday = parts.find(part => part.type === 'weekday').value;
      if (weekday === 'Thu') {
        count++;
      }
    }
  }
  return count;
}

/**
 * Calculates the spawn location based on the known time and the offset.
 *
 * The logic rotates the spawn location forward every hour but “re-anchors” it
 * once at midnight (using the previous midnight’s location) so that the day’s
 * progression starts from that adjusted index.
 *
 * At 4am Eastern Time on Thursdays, we also apply an additional re-anchor.
 * That is, if the projected spawn time (based on the offset) is a Thursday at or
 * after 4am local time, we subtract one extra step.
 *
 * @param {number} offset - The number of hours in the future to calculate for.
 */
function getSpawn(offset) {
  offset = offset ?? 0;

  const now = new Date();
  
  // Calculate how many whole hours have passed since the base time.
  // Include the offset which represents the number of hours in the future to calculate for.
  const hoursElapsed = Math.floor((now - baseTime) / (1000 * 60 * 60)) + offset;

  // Determine the number of full days that have passed and the hour within the current day.
  const daysElapsed = Math.floor(hoursElapsed / 24);
  const hourOfDay = hoursElapsed % 24;

  // Compute the spawn time.
  const spawnTime = new Date(baseTime.getTime() + hoursElapsed * 60 * 60 * 1000);

  // Count extra re-anchor events (Thursday at/after 4am Eastern) that have occurred from baseTime up to spawnTime.
  const extraThursdayAnchors = countExtraThursdayAnchors(baseTime, spawnTime);

  // Each full day (i.e. midnight rollover) subtracts one from the index, plus the extra offsets.
  const anchorIndex = arithmeticMod(baseAnchorIndex - daysElapsed - extraThursdayAnchors, spawnLocations.length);

  // Each day's starting spawn index rotates one step backward.
  //const anchorIndex = arithmeticMod(baseAnchorIndex - daysElapsed, spawnLocations.length);

  // Then the hourly rotation moves forward from that daily start index.
  const spawnIndex = (anchorIndex + hourOfDay) % spawnLocations.length;

  const { chest, ore } = spawnLocations[spawnIndex];

  return {
    time: new Date(baseTime.getTime() + hoursElapsed * 60 * 60 * 1000),
    chest,
    ore,
    isSkipped: isSkippedTime(spawnTime)
  };
}

export default function Home() {
  const [countdown, setCountdown] = useState('--:--');
  const [spawnLocation, setSpawnLocation] = useState({ chest: '--', ore: '--', isSkipped: false });
  const [futureSpawns, setFutureSpawns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const loadOffset = useRef(0);
  const spawnTime = useRef(null);

  const updateCountdown = () => {
    const now = new Date();

    // If we're in the "Spawning now" period...
    if (spawnTime.current instanceof Date) {
      const elapsed = now - spawnTime.current;

      // Display "Spawning now" for at least 1 minute
      if (elapsed < 1000 * 60) {
        setCountdown('Spawning now');
        return; // exit early to keep displaying the message
      } else {
        // One minute has passed; reset spawnStartTime and update target
        spawnTime.current = null;
      }
    }

    const target = getNextSpawnTime();
    const difference = target.getTime() - now.getTime();

    if (difference <= 1000) {
      spawnTime.current = now;
      setCountdown('Spawning now');
    } else {
      const hours = Math.floor((difference / 1000 / 60 / 60) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      if (hours > 0) {
        setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }
  };

  const loadMoreSpawns = (count = 3) => {
    setLoading(true);
    const newSpawns = [];
    for (let i = loadOffset.current; i < loadOffset.current + count; i++) {
      newSpawns.push(getSpawn(i));
    }
    loadOffset.current += count;
    setFutureSpawns(prev => [...prev, ...newSpawns]);
    setLoading(false);
  };

  const ensureScrollable = () => {
    if (document.documentElement.scrollHeight <= window.innerHeight && !loading) {
      loadMoreSpawns(3);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      updateCountdown();
      setSpawnLocation(getNextSpawnLocation());
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadMoreSpawns(3);

    const handleScroll = () => {
      const bottomBuffer = 200;
      const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - bottomBuffer;
      if (bottom && !loading) loadMoreSpawns();
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    const observer = new MutationObserver(ensureScrollable);
    observer.observe(document.body, { childList: true, subtree: true });
    ensureScrollable();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [loading]);

  return (
    <main className="bg-gray-900 text-white min-h-screen flex flex-col items-center p-6 relative">
      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Project Chronorift (v0.1.0)</h1>
      </header>

      <section className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-2xl mb-6">
        <h2 className="text-xl font-semibold mb-2">Next Spawn In</h2>
        <div className="text-4xl font-bold text-green-400">{countdown}</div>
      </section>

      <section className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-2xl mb-6">
        <h2 className="text-xl font-semibold mb-4">Next Spawn Location</h2>
        {spawnLocation.isSkipped ? (
          <div className="text-center text-red-400 text-lg">No Spawns Scheduled</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-xl">
              <p className="text-sm text-gray-400">Chest Location</p>
              <p className="text-xl font-medium">{spawnLocation.chest}</p>
            </div>
            <div className="bg-gray-700 p-4 rounded-xl">
              <p className="text-sm text-gray-400">Ore Location</p>
              <p className="text-xl font-medium">{spawnLocation.ore}</p>
            </div>
          </div>
        )}
      </section>

      <section className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-2xl">
        <h2 className="text-xl font-semibold mb-4 text-left">Spawn Schedule</h2>
        <div className="space-y-2">
          {futureSpawns.map(({ time, chest, ore, isSkipped }, idx) => (
            <div 
              key={`${time}-${idx}`} 
              className={`grid grid-cols-3 gap-4 p-3 rounded-xl text-sm md:text-base ${
                time.getFullYear() === currentDate.getFullYear() &&
                time.getMonth() === currentDate.getMonth() &&
                time.getDate() === currentDate.getDate() &&
                time.getHours() === currentDate.getHours() ? 
                'bg-green-900 text-white' : 'bg-gray-700'
              }`}
            >
              <p className="text-left">
                {time.toLocaleString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </p>
              {isSkipped ? (
                <p className="col-span-2 text-left text-red-400">No Spawns Scheduled</p>
              ) : (
                <>
                  <p className="text-left"><span className="text-blue-400">Chest:</span> {chest}</p>
                  <p className="text-left"><span className="text-yellow-400">Ore:</span> {ore}</p>
                </>
              )}
            </div>
          ))}
          {loading && (
            <div className="text-center text-gray-400 py-4">Loading more spawns...</div>
          )}
        </div>
      </section>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg transition"
        >
          ↑ Top
        </button>
      )}
    </main>
  );
}
