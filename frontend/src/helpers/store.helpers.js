/**
 * Generates a signature for the given object by summing the ASCII codes of its string values.
 *
 * @param {Object} obj - The object to generate a signature for.
 * @returns {number} The signature of the object.
 */
function generateSignature(obj) {
    return Object.values(obj || {})
        .filter(value => value)
        .join('')
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

module.exports = {
    generateSignature
}