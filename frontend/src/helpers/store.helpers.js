/**
 * Returns the length of concatenated values of an object's properties.
 * @param {Object} obj - The object whose properties are to be concatenated.
 * @returns {number} - The length of concatenated values.
 */
function generateSignature(obj) {
    let length = 0;

    for (const value of Object.values(obj || {})) {
        if (value) {
            length += value.toString().length;
        }
    }

    return length;
}

module.exports = {
    generateSignature
}