import { useState } from "react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="bg-gray-50 border rounded p-4">
      <h3 className="font-bold text-lg mb-2">Newsletter</h3>
      <p className="text-sm text-gray-600 mb-3">
        Recevez les dernières nouveautés du livre audio gratuit.
      </p>
      {subscribed ? (
        <p className="text-sm text-green-700">Merci pour votre inscription !</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubscribed(true);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Votre adresse email"
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
          >
            S'inscrire
          </button>
        </form>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Inscription fictive en V1 — fonctionnalité active à venir.
      </p>
    </div>
  );
}
