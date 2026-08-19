// Single source of truth for both the client selects and server-side validation.
// Format: name:dial:ISO-3166-alpha-2
const RAW =
  'Afghanistan:93:AF,Albania:355:AL,Algeria:213:DZ,Andorra:376:AD,Angola:244:AO,Argentina:54:AR,Armenia:374:AM,' +
  'Australia:61:AU,Austria:43:AT,Azerbaijan:994:AZ,Bahamas:1242:BS,Bahrain:973:BH,Bangladesh:880:BD,Barbados:1246:BB,' +
  'Belarus:375:BY,Belgium:32:BE,Belize:501:BZ,Benin:229:BJ,Bhutan:975:BT,Bolivia:591:BO,Bosnia and Herzegovina:387:BA,' +
  'Botswana:267:BW,Brazil:55:BR,Brunei:673:BN,Bulgaria:359:BG,Burkina Faso:226:BF,Burundi:257:BI,Cambodia:855:KH,' +
  'Cameroon:237:CM,Canada:1:CA,Cape Verde:238:CV,Chad:235:TD,Chile:56:CL,China:86:CN,Colombia:57:CO,Costa Rica:506:CR,' +
  'Croatia:385:HR,Cuba:53:CU,Cyprus:357:CY,Czechia:420:CZ,Democratic Republic of the Congo:243:CD,Denmark:45:DK,' +
  'Djibouti:253:DJ,Dominican Republic:1809:DO,Ecuador:593:EC,Egypt:20:EG,El Salvador:503:SV,Estonia:372:EE,' +
  'Eswatini:268:SZ,Ethiopia:251:ET,Fiji:679:FJ,Finland:358:FI,France:33:FR,Gabon:241:GA,Georgia:995:GE,Germany:49:DE,' +
  'Ghana:233:GH,Greece:30:GR,Guatemala:502:GT,Guinea:224:GN,Guyana:592:GY,Haiti:509:HT,Honduras:504:HN,Hong Kong:852:HK,' +
  'Hungary:36:HU,Iceland:354:IS,India:91:IN,Indonesia:62:ID,Iraq:964:IQ,Ireland:353:IE,Israel:972:IL,Italy:39:IT,' +
  'Ivory Coast:225:CI,Jamaica:1876:JM,Japan:81:JP,Jordan:962:JO,Kazakhstan:7:KZ,Kenya:254:KE,Kuwait:965:KW,' +
  'Kyrgyzstan:996:KG,Laos:856:LA,Latvia:371:LV,Lebanon:961:LB,Lesotho:266:LS,Liberia:231:LR,Libya:218:LY,' +
  'Liechtenstein:423:LI,Lithuania:370:LT,Luxembourg:352:LU,Madagascar:261:MG,Malawi:265:MW,Malaysia:60:MY,' +
  'Maldives:960:MV,Mali:223:ML,Malta:356:MT,Mauritania:222:MR,Mauritius:230:MU,Mexico:52:MX,Moldova:373:MD,' +
  'Monaco:377:MC,Mongolia:976:MN,Montenegro:382:ME,Morocco:212:MA,Mozambique:258:MZ,Myanmar:95:MM,Namibia:264:NA,' +
  'Nepal:977:NP,Netherlands:31:NL,New Zealand:64:NZ,Nicaragua:505:NI,Niger:227:NE,Nigeria:234:NG,' +
  'North Macedonia:389:MK,Norway:47:NO,Oman:968:OM,Pakistan:92:PK,Panama:507:PA,Papua New Guinea:675:PG,' +
  'Paraguay:595:PY,Peru:51:PE,Philippines:63:PH,Poland:48:PL,Portugal:351:PT,Qatar:974:QA,Romania:40:RO,Rwanda:250:RW,' +
  'Saudi Arabia:966:SA,Senegal:221:SN,Serbia:381:RS,Seychelles:248:SC,Sierra Leone:232:SL,Singapore:65:SG,' +
  'Slovakia:421:SK,Slovenia:386:SI,Somalia:252:SO,South Africa:27:ZA,South Korea:82:KR,Spain:34:ES,Sri Lanka:94:LK,' +
  'Sudan:249:SD,Sweden:46:SE,Switzerland:41:CH,Taiwan:886:TW,Tajikistan:992:TJ,Tanzania:255:TZ,Thailand:66:TH,' +
  'Togo:228:TG,Trinidad and Tobago:1868:TT,Tunisia:216:TN,Turkey:90:TR,Turkmenistan:993:TM,Uganda:256:UG,Ukraine:380:UA,' +
  'United Arab Emirates:971:AE,United Kingdom:44:GB,United States:1:US,Uruguay:598:UY,Uzbekistan:998:UZ,' +
  'Venezuela:58:VE,Vietnam:84:VN,Yemen:967:YE,Zambia:260:ZM,Zimbabwe:263:ZW';

export const COUNTRIES = RAW.split(',').map(entry => {
  const [name, dial, iso] = entry.split(':');
  // regional indicator pair — renders as the flag wherever the OS has one
  const flag = String.fromCodePoint(...[...iso].map(ch => 0x1f1e6 - 65 + ch.charCodeAt(0)));
  return { name, iso, flag, dial: `+${dial}` };
});

export const COUNTRY_NAMES = new Set(COUNTRIES.map(c => c.name));
export const DIAL_CODES = new Set(COUNTRIES.map(c => c.dial));
