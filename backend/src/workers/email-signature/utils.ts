import { SupabaseClient } from '@supabase/supabase-js';
import { Contact } from '../../db/types';

/* eslint-disable no-useless-escape */
export const FORWARDED_SEPARATOR_REGEX = [
  /^>?\s*Begin forwarded message\s?:/m, // Apple Mail (en)
  /^>?\s*Začátek přeposílané zprávy\s?:/m, // Apple Mail (cs)
  /^>?\s*Start på videresendt besked\s?:/m, // Apple Mail (da)
  /^>?\s*Anfang der weitergeleiteten Nachricht\s?:/m, // Apple Mail (de)
  /^>?\s*Inicio del mensaje reenviado\s?:/m, // Apple Mail (es)
  /^>?\s*Välitetty viesti alkaa\s?:/m, // Apple Mail (fi)
  /^>?\s*Début du message réexpédié\s?:/m, // Apple Mail (fr)
  /^>?\s*Début du message transféré\s?:/m, // Apple Mail iOS (fr)
  /^>?\s*Započni proslijeđenu poruku\s?:/m, // Apple Mail (hr)
  /^>?\s*Továbbított levél kezdete\s?:/m, // Apple Mail (hu)
  /^>?\s*Inizio messaggio inoltrato\s?:/m, // Apple Mail (it)
  /^>?\s*Begin doorgestuurd bericht\s?:/m, // Apple Mail (nl)
  /^>?\s*Videresendt melding\s?:/m, // Apple Mail (no)
  /^>?\s*Początek przekazywanej wiadomości\s?:/m, // Apple Mail (pl)
  /^>?\s*Início da mensagem reencaminhada\s?:/m, // Apple Mail (pt)
  /^>?\s*Início da mensagem encaminhada\s?:/m, // Apple Mail (pt-br)
  /^>?\s*Începe mesajul redirecționat\s?:/m, // Apple Mail (ro)
  /^>?\s*Начало переадресованного сообщения\s?:/m, // Apple Mail (ro)
  /^>?\s*Začiatok preposlanej správy\s?:/m, // Apple Mail (sk)
  /^>?\s*Vidarebefordrat mejl\s?:/m, // Apple Mail (sv)
  /^>?\s*İleti başlangıcı\s?:/m, // Apple Mail (tr)
  /^>?\s*Початок листа, що пересилається\s?:/m, // Apple Mail (uk)
  /^\s*-{8,10}\s*Forwarded message\s*-{8,10}\s*/m, // Gmail (all locales), Missive (en), HubSpot (en)
  /^\s*_{32}\s*$/m, // Outlook Live / 365 (all locales)
  /^\s?Forwarded message:/m, // Mailmate
  /^\s?Dne\s?.+\,\s?.+\s*[\[|<].+[\]|>]\s?napsal\(a\)\s?:/m, // Outlook 2019 (cz)
  /^\s?D.\s?.+\s?skrev\s?\".+\"\s*[\[|<].+[\]|>]\s?:/m, // Outlook 2019 (da)
  /^\s?Am\s?.+\s?schrieb\s?\".+\"\s*[\[|<].+[\]|>]\s?:/m, // Outlook 2019 (de)
  /^\s?On\s?.+\,\s?\".+\"\s*[\[|<].+[\]|>]\s?wrote\s?:/m, // Outlook 2019 (en)
  /^\s?El\s?.+\,\s?\".+\"\s*[\[|<].+[\]|>]\s?escribió\s?:/m, // Outlook 2019 (es)
  /^\s?Le\s?.+\,\s?«.+»\s*[\[|<].+[\]|>]\s?a écrit\s?:/m, // Outlook 2019 (fr)
  /^\s?.+\s*[\[|<].+[\]|>]\s?kirjoitti\s?.+\s?:/m, // Outlook 2019 (fi)
  /^\s?.+\s?időpontban\s?.+\s*[\[|<|(].+[\]|>|)]\s?ezt írta\s?:/m, // Outlook 2019 (hu)
  /^\s?Il giorno\s?.+\s?\".+\"\s*[\[|<].+[\]|>]\s?ha scritto\s?:/m, // Outlook 2019 (it)
  /^\s?Op\s?.+\s?heeft\s?.+\s*[\[|<].+[\]|>]\s?geschreven\s?:/m, // Outlook 2019 (nl)
  /^\s?.+\s*[\[|<].+[\]|>]\s?skrev følgende den\s?.+\s?:/m, // Outlook 2019 (no)
  /^\s?Dnia\s?.+\s?„.+”\s*[\[|<].+[\]|>]\s?napisał\s?:/mu, // Outlook 2019 (pl)
  /^\s?Em\s?.+\,\s?\".+\"\s*[\[|<].+[\]|>]\s?escreveu\s?:/m, // Outlook 2019 (pt)
  /^\s?.+\s?пользователь\s?\".+\"\s*[\[|<].+[\]|>]\s?написал\s?:/m, // Outlook 2019 (ru)
  /^\s?.+\s?používateľ\s?.+\s*\([\[|<].+[\]|>]\)\s?napísal\s?:/m, // Outlook 2019 (sk)
  /^\s?Den\s?.+\s?skrev\s?\".+\"\s*[\[|<].+[\]|>]\s?följande\s?:/m, // Outlook 2019 (sv)
  /^\s?\".+\"\s*[\[|<].+[\]|>]\,\s?.+\s?tarihinde şunu yazdı\s?:/m, // Outlook 2019 (tr)
  /^\s*-{5,8} Přeposlaná zpráva -{5,8}\s*/m, // Yahoo Mail (cs), Thunderbird (cs)
  /^\s*-{5,8} Videresendt meddelelse -{5,8}\s*/m, // Yahoo Mail (da), Thunderbird (da)
  /^\s*-{5,10} Weitergeleitete Nachricht -{5,10}\s*/m, // Yahoo Mail (de), Thunderbird (de), HubSpot (de)
  /^\s*-{5,8} Forwarded Message -{5,8}\s*/m, // Yahoo Mail (en), Thunderbird (en)
  /^\s*-{5,10} Mensaje reenviado -{5,10}\s*/m, // Yahoo Mail (es), Thunderbird (es), HubSpot (es)
  /^\s*-{5,10} Edelleenlähetetty viesti -{5,10}\s*/m, // Yahoo Mail (fi), HubSpot (fi)
  /^\s*-{5} Message transmis -{5}\s*/m, // Yahoo Mail (fr)
  /^\s*-{5,8} Továbbított üzenet -{5,8}\s*/m, // Yahoo Mail (hu), Thunderbird (hu)
  /^\s*-{5,10} Messaggio inoltrato -{5,10}\s*/m, // Yahoo Mail (it), HubSpot (it)
  /^\s*-{5,10} Doorgestuurd bericht -{5,10}\s*/m, // Yahoo Mail (nl), Thunderbird (nl), HubSpot (nl)
  /^\s*-{5,8} Videresendt melding -{5,8}\s*/m, // Yahoo Mail (no), Thunderbird (no)
  /^\s*-{5} Przekazana wiadomość -{5}\s*/m, // Yahoo Mail (pl)
  /^\s*-{5,8} Mensagem reencaminhada -{5,8}\s*/m, // Yahoo Mail (pt), Thunderbird (pt)
  /^\s*-{5,10} Mensagem encaminhada -{5,10}\s*/m, // Yahoo Mail (pt-br), Thunderbird (pt-br), HubSpot (pt-br)
  /^\s*-{5,8} Mesaj redirecționat -{5,8}\s*/m, // Yahoo Mail (ro)
  /^\s*-{5} Пересылаемое сообщение -{5}\s*/m, // Yahoo Mail (ru)
  /^\s*-{5} Preposlaná správa -{5}\s*/m, // Yahoo Mail (sk)
  /^\s*-{5,10} Vidarebefordrat meddelande -{5,10}\s*/m, // Yahoo Mail (sv), Thunderbird (sv), HubSpot (sv)
  /^\s*-{5} İletilmiş Mesaj -{5}\s*/m, // Yahoo Mail (tr)
  /^\s*-{5} Перенаправлене повідомлення -{5}\s*/m, // Yahoo Mail (uk)
  /^\s*-{8} Välitetty viesti \/ Fwd.Msg -{8}\s*/m, // Thunderbird (fi)
  /^\s*-{8,10} Message transféré -{8,10}\s*/m, // Thunderbird (fr), HubSpot (fr)
  /^\s*-{8} Proslijeđena poruka -{8}\s*/m, // Thunderbird (hr)
  /^\s*-{8} Messaggio Inoltrato -{8}\s*/m, // Thunderbird (it)
  /^\s*-{3} Treść przekazanej wiadomości -{3}\s*/m, // Thunderbird (pl)
  /^\s*-{8} Перенаправленное сообщение -{8}\s*/m, // Thunderbird (ru)
  /^\s*-{8} Preposlaná správa --- Forwarded Message -{8}\s*/m, // Thunderbird (sk)
  /^\s*-{8} İletilen İleti -{8}\s*/m, // Thunderbird (tr)
  /^\s*-{8} Переслане повідомлення -{8}\s*/m, // Thunderbird (uk)
  /^\s*-{9,10} メッセージを転送 -{9,10}\s*/mu, // HubSpot (ja)
  /^\s*-{9,10} Wiadomość przesłana dalej -{9,10}\s*/m, // HubSpot (pl)
  /^>?\s*-{10} Original Message -{10}\s*/m // IONOS by 1 & 1 (en)
];

export const REPLY_SEPARATOR_REGEX = ['------------------------------\n'];

export const REPLY_MARKER_REGEX: RegExp[] = [
  // English
  /^>?\s*On\s[\d\/]+,\s(at\s)?[\d:]+,\s.+?\s<.+?>\s?/im,

  // French: Le 15/05/2025, à 19:01, Badreddine Ladjemi <email@example.com>
  /^>?\s*Le\s[\d\/]+,\sà\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Spanish: El 15/05/2025, a las 19:01, Nombre Apellido <email@example.com>
  /^>?\s*El\s[\d\/]+,\sa las\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // German: Am 15.05.2025, um 19:01, Name Nachname <email@example.com>
  /^>?\s*Am\s[\d\.]+,\sum\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Italian: Il 15/05/2025, alle 19:01, Nome Cognome <email@example.com>
  /^>?\s*Il\s[\d\/]+,\salle\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Dutch: Op 15/05/2025, om 19:01, Naam Achternaam <email@example.com>
  /^>?\s*Op\s[\d\/]+,\som\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Portuguese: Em 15/05/2025, às 19:01, Nome Sobrenome <email@example.com>
  /^>?\s*Em\s[\d\/]+,\sàs\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Swedish: Den 15/05/2025, kl. 19:01, Namn Efternamn <email@example.com>
  /^>?\s*Den\s[\d\/]+,\skl\.\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Danish: Den 15/05/2025, kl. 19:01, Navn Efternavn <email@example.com>
  /^>?\s*Den\s[\d\/]+,\skl\.\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Finnish: Päiväys 15.05.2025 klo 19:01, Nimi Sukunimi <email@example.com>
  /^>?\s*Päiväys\s[\d\.]+,\sklo\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Czech: Dne 15.05.2025, v 19:01, Jméno Příjmení <email@example.com>
  /^>?\s*Dne\s[\d\.]+,\sv\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Hungarian: 2025.05.15., 19:01-kor, Név Vezetéknév <email@example.com>
  /^>?\s*[\d\.]+,\s[\d:]+-kor,\s.+?\s<.+?>\s?/im,

  // Polish: W dniu 15.05.2025, o godz. 19:01, Imię Nazwisko <email@example.com>
  /^>?\s*W dniu\s[\d\.]+,\so godz\.\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Romanian: La data de 15.05.2025, ora 19:01, Nume Prenume <email@example.com>
  /^>?\s*La data de\s[\d\.]+,\sora\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Russian: 15.05.2025 в 19:01, Имя Фамилия <email@example.com>
  /^>?\s*[\d\.]+\sв\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Turkish: 15.05.2025 tarihinde, saat 19:01, İsim Soyisim <email@example.com>
  /^>?\s*[\d\.]+\starihinde,\ssaat\s[\d:]+,\s.+?\s<.+?>\s?/im,

  // Ukrainian: 15.05.2025 о 19:01, Ім'я Прізвище <email@example.com>
  /^>?\s*[\d\.]+\sо\s[\d:]+,\s.+?\s<.+?>\s?/im
];

export function getOriginalMessage(emailText: string): string {
  const allRegexes = [
    ...FORWARDED_SEPARATOR_REGEX,
    ...REPLY_SEPARATOR_REGEX,
    ...REPLY_MARKER_REGEX
  ];

  for (const regex of allRegexes) {
    const match = emailText.match(regex);
    if (match?.index !== undefined) {
      return emailText.slice(0, match.index).trim();
    }
  }

  return emailText.trim();
}

export type NotificationType = 'enrich' | 'clean' | 'extract' | 'signature';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  details: {
    signatures: number;
    extracted: Partial<Contact>[];
  };
}

/**
 * Push a new notification to the Supabase `notifications` table.
 */
export async function pushNotificationDB(
  supabase: SupabaseClient,
  { userId, type, details }: NotificationPayload
) {
  const { error } = await supabase
    .schema('private')
    .from('notifications')
    .insert([{ user_id: userId, type, details }]);

  if (error) throw error;
}

export function isUsefulSignatureContent(signature: string): boolean {
  const text = signature.trim();

  const hasURL = /(https?:\/\/|www\.)\S+/i.test(text);
  const hasDigits = /\d{3,}/.test(text);
  const hasMultipleWords = text.split(/\s+/).length >= 5;
  const hasSymbols = /[@+:]/.test(text); // Common in phone/email/title formats

  const useful = hasURL || hasDigits || hasSymbols || hasMultipleWords;

  return useful;
}
