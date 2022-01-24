import {markRaw} from "vue"
export default function () {
  return {
    retrievedEmails : markRaw([])
  }
}
