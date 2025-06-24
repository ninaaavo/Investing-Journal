import { useState } from "react";

const moodEmojis = ["😊", "😰", "😢", "😡", "😐", "😎", "🤔", "🙃"];

export default function EmojiSelector({ onSelect, defaultEmoji = "😊" }) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(defaultEmoji);

  const handleEmojiClick = (emoji) => {
    setSelectedEmoji(emoji);
    onSelect(emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative">
      <button
        className="px-2 py-1 text-lg hover:scale-110 transition hover:opacity-80"
        onClick={(e) => {
          e.preventDefault();
          setShowPicker(!showPicker);
        }}
      >
        {selectedEmoji}
      </button>

      {showPicker && (
        <div className="absolute z-10 bg-white border rounded shadow-md p-2 grid grid-cols-4 gap-1 top-full mt-1 w-[150px]">
          {moodEmojis.map((emoji) => (
            <button
              key={emoji}
              className="text-xl hover:scale-110 transition"
              onClick={(e) => {
                e.preventDefault();
                handleEmojiClick(emoji);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
