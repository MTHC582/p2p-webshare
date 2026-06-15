// helper functions used across the app

// makes a random room id thats 6 chars long. i use base36 to make it alphanumeric
// and substring it so it's a short 6 character room code that's easy to copy/paste
export function generateRoomId() {
  let result = Math.random().toString(36);
  result = result.substring(2, 8);
  return result;
}

// i made this to show file sizes in a readable way like KB, MB etc.
// it uses base 1024 math and matches with units array index.
// i check if index > 0 to see if we should show decimal points (like 12.5 MB)
// or just bytes without decimals (like 400 B)
export function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  let units = ['B', 'KB', 'MB', 'GB'];
  let i = Math.floor(Math.log(bytes) / Math.log(1024));
  let value = bytes / Math.pow(1024, i);

  // dont show decimals for bytes, but show 1 decimal for KB/MB/GB
  if (i > 0) {
    return value.toFixed(1) + ' ' + units[i];
  } else {
    return value.toFixed(0) + ' ' + units[i];
  }
}

// uses the browsers built in crypto API to compute SHA-256 hash of file buffers
// i need this to verify file integrity after transfer.
// standard crypto.subtle.digest returns raw bytes, so i have to loop through
// and convert every single byte to a 2 digit hex string so we get the normal hash format
export async function computeHash(buffer) {
  let hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // convert the hash from ArrayBuffer to hex string
  let hashArray = Array.from(new Uint8Array(hashBuffer));
  let hexString = '';
  for (let i = 0; i < hashArray.length; i++) {
    let hex = hashArray[i].toString(16);
    // pad single digit hex values with a 0 so they are always 2 characters
    if (hex.length === 1) {
      hex = '0' + hex;
    }
    hexString += hex;
  }

  return hexString;
}
