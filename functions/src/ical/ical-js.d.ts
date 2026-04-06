declare module 'ical.js' {
  export class Time {
    year: number
    month: number
    day: number
  }

  export class Component {
    constructor(jcal: unknown)
    getAllSubcomponents(name: string): Component[]
  }

  export class Event {
    constructor(component: Component)
    uid: string
    summary: string
    startDate: Time
    endDate: Time
  }

  export function parse(icsText: string): unknown

  const ICAL: {
    parse: typeof parse
    Component: typeof Component
    Event: typeof Event
    Time: typeof Time
  }

  export default ICAL
}
