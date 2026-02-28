const MarqueeText = () => {
  const items = [
    "AI Face Detection",
    "Live Proctoring",
    "Browser Lockdown",
    "Eye & Head Movement Tracking",
    "Audio Monitoring",
    "Real-Time Alerts",
    "Secure Exam Environment",
    "Scalable for Universities",
  ];

  return (
    <div
      className="overflow-hidden border-y border-gray-200 py-3 select-none marquee-container"
    >
      <div className="flex gap-4 md:gap-8 min-w-max">
        <ul className="flex gap-4 md:gap-8 animate-scroll">
          {items.map((item, i) => (
            <li
              key={i}
              className="font-medium text-gray-700 "
            >
              {item}
            </li>
          ))}
        </ul>
        <ul
          aria-hidden="true"
          className="flex gap-4 md:gap-8 animate-scroll"
        >
          {items.map((item, i) => (
            <li
              key={i}
              className="font-medium text-gray-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MarqueeText;
