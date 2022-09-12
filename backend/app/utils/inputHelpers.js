const casesForPosition = [
    [1, 0, 100],
    [2, 101, 399],
    [3, 400, 799],
    [5, 800, 14],
    [10, 500, 999],
    [15, 1000, 7999],
    [50, 8000, 19999],
    [500, 20000, 60000],
    [700, 60001, 100000],
    [1000, 100001, 500001],
  ],
  casesForData = [
    [1, 0, 100],
    [2, 101, 399],
    [3, 400, 799],
    [5, 800, 999],
    [10, 1000, 7999],
    [15, 8000, 19999],
    [25, 20000, 60000],
    [40, 60001, 100000],
    [35, 100001, 500001],
  ];
/**
 * Returns an array of integers used in sending progress status.
 * @param  {integer} total box total messages
 * @returns {Array}
 *
 */
function EqualPartsForSocket(total, type) {
  const casesObject = type == "position" ? casesForPosition : casesForData;

  function inRange(n, nStart, nEnd) {
    if (n >= nStart && n <= nEnd) {
      return true;
    }
    return false;
  }
  let boxCount = total;
  const values = [];
  let n = 350;

  for (const i of casesObject) {
    if (inRange(boxCount, i[1], i[2])) {
      n = i[0];
      break;
    } else if (i == casesObject[casesObject.length - 1]) {
      break;
    } else {
      continue;
    }
  }
  while (boxCount > 0 && n > 0) {
    const a = Math.floor(boxCount / n);

    boxCount -= a;
    n--;
    values.push(a);
  }
  const Parts = [];

  values.reduce((prev, curr, i) => (Parts[i] = prev + curr), 0);
  return Parts;
}

exports.EqualPartsForSocket = EqualPartsForSocket;
