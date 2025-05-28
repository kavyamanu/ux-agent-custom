import Image from "next/image";
import Link from "next/link";

const categories = [
  { name: "Breakfast", image: "/placeholder.svg?height=100&width=100" },
  { name: "Lunch", image: "/placeholder.svg?height=100&width=100" },
  { name: "Dinner", image: "/placeholder.svg?height=100&width=100" },
  { name: "Snacks", image: "/placeholder.svg?height=100&width=100" },
  { name: "Desserts", image: "/placeholder.svg?height=100&width=100" },
  { name: "Beverages", image: "/placeholder.svg?height=100&width=100" },
];

export function Categories() {
  return (
    <section className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Categories</h2>
      <div className="grid grid-cols-3 gap-4">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={`/category/${category.name.toLowerCase()}`}
            className="flex flex-col items-center"
          >
            <div className="relative w-20 h-20 mb-2">
              <Image
                src={category.image || "/placeholder.svg"}
                alt={category.name}
                fill
                className="object-cover rounded-full"
              />
            </div>
            <span className="text-sm font-medium">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
