/** Accepted XMLTV DTD identifiers are inert metadata: never load their target. */
const ALLOWED_DTD_IDS = new Set([
  "xmltv.dtd",
  "https://nzxmltv.com/nzxmltv.dtd",
]);

export function isAllowedXmltvDoctype(declaration:string):boolean {
  const match=/^\s*tv\s+SYSTEM\s+(["'])([^"'<>]+)\1\s*$/i.exec(declaration);
  return !!match && ALLOWED_DTD_IDS.has(match[2]??"");
}

/** Fail closed on any other DOCTYPE or ENTITY declaration, including subsets.
 * A valid declaration is not removed from the XML; the SAX decoder verifies it
 * again, without resolving external DTDs.
 */
export function assertSafeXmltvDeclarations(xml:string):void {
  const withoutAllowed=xml.replace(/<!DOCTYPE\s+tv\s+SYSTEM\s+(["'])([^"'<>]+)\1\s*>/gi,
    (declaration, _quote:string, identifier:string)=>
      ALLOWED_DTD_IDS.has(identifier)? "":declaration);
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(withoutAllowed))
    throw new Error("EPG_XML_SECURITY_REJECTED");
}
