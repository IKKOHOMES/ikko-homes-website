import { Mail, MapPin, Phone } from 'lucide-react';

export function ContactPage() {
  return <section className="contact-page">
    <div className="contact-page__intro"><p className="eyebrow">Contact</p><h1>Let’s create your home.</h1><p>Visit our studio, call us, or send an email to start a conversation about your interior project.</p></div>
    <div className="contact-page__details"><ul aria-label="Contact methods" className="contact-page__methods">
      <li><Phone aria-hidden="true" size={18} /><a href="tel:+61490384021">0490 384 021</a></li>
      <li><Mail aria-hidden="true" size={18} /><a href="mailto:info@ikkohomes.com.au">info@ikkohomes.com.au</a></li>
      <li><MapPin aria-hidden="true" size={18} /><address>69 Patricia Loop, Keysborough VIC 3173</address></li>
    </ul></div>
  </section>;
}
