import { useState, useRef, useEffect } from "react";

const EMOJI_CATEGORIES = [
  {
    id: "popular",
    name: "Popular",
    icon: "🔥",
    emojis: [
      "😂", "❤️", "👍", "🔥", "✨", "🥺", "😭", "🥰", "😍", "😊",
      "🙏", "👏", "🎉", "💯", "💀", "👀", "🚀", "😎", "🤔", "😴",
      "🥳", "🤩", "💖", "✌️", "🙌", "👋", "🫡", "💪", "🫶", "💔",
      "☕", "🍕", "🎮", "🎵", "💡", "📚", "⭐", "⚡", "🌟", "🎯",
    ],
  },
  {
    id: "smileys",
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "🥹",
      "☺️", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗",
      "😙", "😚", "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎",
      "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁",
      "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡",
      "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓",
      "🤗", "🤔", "🫣", "🤭", "🫢", "🫡", "🤫", "🫠", "🤥", "😶",
      "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱",
      "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷",
    ],
  },
  {
    id: "gestures",
    name: "Gestures",
    icon: "👍",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
      "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶",
      "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿",
      "👀", "👁️", "👅", "👄", "🫦", "🫂", "👤", "👥", "🧠", "🫀",
    ],
  },
  {
    id: "hearts",
    name: "Hearts & Vibes",
    icon: "💜",
    emojis: [
      "💜", "❤️", "🧡", "💛", "💚", "💙", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
      "💟", "☮️", "✨", "🌟", "⭐", "💫", "⚡", "💥", "🔥", "🌈",
      "☀️", "🌙", "☁️", "🌧️", "❄️", "🪄", "🔮", "💎", "💐", "🌸",
    ],
  },
  {
    id: "fun",
    name: "Objects & Food",
    icon: "☕",
    emojis: [
      "☕", "🍵", "🧋", "🥤", "🍺", "🍻", "🍷", "🍕", "🍔", "🍟",
      "🌭", "🍿", "🌮", "🍣", "🍱", "🍜", "🍰", "🎂", "🍩", "🍪",
      "🎮", "🕹️", "🎯", "🎲", "🎨", "🎤", "🎧", "🎵", "🎸", "🎬",
      "📱", "💻", "⌨️", "🖥️", "📷", "💡", "💰", "💸", "🎁", "🎈",
      "🏆", "🥇", "⚽", "🏀", "🚀", "✈️", "🚗", "🚲", "🏖️", "⛺",
    ],
  },
];

function EmojiPicker({ onSelectEmoji, onClose }) {
  const [activeCategory, setActiveCategory] = useState("popular");
  const pickerRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    function handlePointerDown(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Find the selected category (defaults to popular)
  const currentCategory =
    EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory) ||
    EMOJI_CATEGORIES[0];

  return (
    <div
      ref={pickerRef}
      className="emoji-picker-container"
      role="dialog"
      aria-label="Emoji Picker"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="emoji-picker-header">
        <span className="emoji-picker-title">Emojis</span>
        <button
          type="button"
          className="emoji-picker-close-btn"
          onClick={onClose}
          aria-label="Close emoji picker"
        >
          ✕
        </button>
      </div>

      <div className="emoji-categories-bar">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`emoji-cat-btn ${
              activeCategory === cat.id ? "active" : ""
            }`}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.name}
            aria-label={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      <div className="emoji-grid">
        {currentCategory.emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            className="emoji-item-btn"
            onClick={() => onSelectEmoji(emoji)}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiPicker;
