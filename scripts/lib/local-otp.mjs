// Read only an explicitly addressed ephemeral test message from the fixed local inbox.
export async function localOtp(email) {
  if (!email.endsWith("@example.invalid"))
    throw new Error("Only ephemeral local test addresses allowed");
  for (let attempt = 0; attempt < 30; attempt++) {
    const inbox = await (
      await fetch("http://127.0.0.1:55324/api/v1/messages")
    ).json();
    const message = inbox.messages?.find((m) =>
      m.To?.some((to) => to.Address === email),
    );
    if (message) {
      const full = await (
        await fetch(
          `http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`,
        )
      ).json();
      const code = full.Text?.match(/\b[0-9]{6}\b/)?.[0];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Local OTP message did not arrive");
}
