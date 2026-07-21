import { ALASKA_MAX_MESSAGE_AGE_MINUTES, isAllowedAlaskaBookingPage } from './alaska-policy.js';
import { EASYJET_MAX_MESSAGE_AGE_MINUTES, isAllowedEasyJetBookingPage } from './easyjet-policy.js';

export type LiveAirlineId = 'easyjet' | 'alaska';

export type LiveAirlineProfile = {
  id: LiveAirlineId;
  displayName: string;
  serviceHint: string;
  mailboxPurpose: 'easyjet_booking_lookup' | 'alaska_booking_lookup';
  maxMessageAgeMinutes: number;
  allowsReferenceOnly: boolean;
  isAllowedBookingPage: (input: string | null | undefined) => boolean;
};

const profiles: Record<LiveAirlineId, LiveAirlineProfile> = {
  easyjet: {
    id: 'easyjet',
    displayName: 'easyJet',
    serviceHint: 'easyJet',
    mailboxPurpose: 'easyjet_booking_lookup',
    maxMessageAgeMinutes: EASYJET_MAX_MESSAGE_AGE_MINUTES,
    allowsReferenceOnly: true,
    isAllowedBookingPage: isAllowedEasyJetBookingPage,
  },
  alaska: {
    id: 'alaska',
    displayName: 'Alaska Airlines',
    serviceHint: 'Alaska Airlines',
    mailboxPurpose: 'alaska_booking_lookup',
    maxMessageAgeMinutes: ALASKA_MAX_MESSAGE_AGE_MINUTES,
    allowsReferenceOnly: false,
    isAllowedBookingPage: isAllowedAlaskaBookingPage,
  },
};

export function liveAirlineProfile(id: LiveAirlineId): LiveAirlineProfile {
  return profiles[id];
}

export function liveAirlineForUrl(input: string | null | undefined): LiveAirlineProfile | null {
  return Object.values(profiles).find((profile) => profile.isAllowedBookingPage(input)) ?? null;
}
