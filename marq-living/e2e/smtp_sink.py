# Stores every email as a file so the test can read invite/confirm links.
import asyncore, smtpd, sys, os, time
out = sys.argv[1]
class Sink(smtpd.SMTPServer):
    def process_message(self, peer, mailfrom, rcpttos, data, **kw):
        name = os.path.join(out, f"{time.time_ns()}-{rcpttos[0]}.eml")
        with open(name, "wb") as f: f.write(data if isinstance(data, bytes) else data.encode())
Sink(("127.0.0.1", 2525), None, decode_data=False)
asyncore.loop()
