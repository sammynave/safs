/*
HLC guarantees

1. All events created on a single machine will be correctly ordered with
  respect to each other (even if the wall clock jumps back a second or is otherwise erratic).

2. Once machine A sends events to machine B, all events subsequently created
on machine B will be ordered as after those events from machine A.
So if A sets their clock one day ahead, makes some changes, and sends them to B,
B will still be able to make changes even though its own wall clock is ‘behind’.

source: https://jaredforsyth.com/posts/hybrid-logical-clocks/
*/

export type HLC = {
	ts: number;
	count: number;
	node: string;
};

const BASE = 36;
export const pack = ({ ts, count, node }: HLC) => {
	// 13 digits is enough for the next 100 years, so this is probably fine
	return `${ts.toString().padStart(15, '0')}:${count.toString(BASE).padStart(5, '0')}:${node}`;
};

export const unpack = (serialized: string) => {
	const [ts, count, ...node] = serialized.split(':');
	return {
		ts: parseInt(ts),
		count: parseInt(count, BASE),
		node: node.join(':')
	};
};

export const init = (node: string, now: number): HLC => ({
	ts: now,
	count: 0,
	node
});

// if `one` is less, return negative
// if `two` is less, return positive
// this can be passed as a comparator to .sort()
// to order an array of HLCs from earliest to latest
export const cmp = (one: HLC, two: HLC) => {
	if (one.ts == two.ts) {
		if (one.count === two.count) {
			if (one.node === two.node) {
				return 0;
			}
			return one.node < two.node ? -1 : 1;
		}
		return one.count - two.count;
	}
	return one.ts - two.ts;
};

export const inc = (local: HLC, now: number): HLC => {
	if (now > local.ts) {
		return { ts: now, count: 0, node: local.node };
	}

	return { ...local, count: local.count + 1 };
};

export const recv = (local: HLC, remote: HLC, now: number): HLC => {
	if (now > local.ts && now > remote.ts) {
		return { ...local, ts: now, count: 0 };
	}

	if (local.ts === remote.ts) {
		return { ...local, count: Math.max(local.count, remote.count) + 1 };
	} else if (local.ts > remote.ts) {
		return { ...local, count: local.count + 1 };
	} else {
		return { ...local, ts: remote.ts, count: remote.count + 1 };
	}
};

// This impl is closer to the article's algorithm, but I find it a little trickier to explain.
// export const recv = (time: HLC, remote: HLC, now: number): HLC => {
//     const node = time.node;
//     const ts = Math.max(time.ts, remote.ts, now);
//     if (ts == time.ts && ts == remote.ts) {
//         return { node, ts, count: Math.max(time.count, remote.count) + 1 };
//     }
//     if (ts == time.ts) {
//         return { node, ts, count: time.count + 1 };
//     }
//     if (ts == remote.ts) {
//         return { node, ts, count: remote.count + 1 };
//     }
//     return { node, ts, count: 0 };
// };

const validate = (time: HLC, now: number, maxDrift: number = 60 * 1000) => {
	if (time.count > Math.pow(BASE, 5)) {
		return 'counter-overflow';
	}
	// if a timestamp is more than 1 minute off from our local wall clock, something has gone horribly wrong.
	if (Math.abs(time.ts - now) > maxDrift) {
		return 'clock-off';
	}
	return null;
};
