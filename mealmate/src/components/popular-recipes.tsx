import Image from "next/image";
import Link from "next/link";

const popularRecipes = [
  {
    id: 1,
    name: "Creamy Mushroom Pasta",
    time: "25 mins",
    difficulty: "Easy",
    image: "/placeholder.svg?height=200&width=400",
  },
  {
    id: 2,
    name: "Quinoa Chickpea Bowl",
    time: "20 mins",
    difficulty: "Easy",
    image: "/placeholder.svg?height=200&width=400",
  },
];

export function PopularRecipes() {
  return (
    <section className="px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Popular Recipes</h2>
        <Link href="/recipes" className="text-sm text-gray-500">
          View All
        </Link>
      </div>

      <div className="space-y-6">
        {popularRecipes.map((recipe) => (
          <div key={recipe.id} className="space-y-2">
            <div className="relative w-full h-48">
              <Image
                src={recipe.image || "/placeholder.svg"}
                alt={recipe.name}
                fill
                className="object-cover rounded-lg"
              />
            </div>
            <h3 className="font-medium">{recipe.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {recipe.time}
              </div>
              <div className="flex items-center ml-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 4-3 4-6.5-2.5 0-4 2.5-7 2.5-4 0-7-8-11-8 0 3 4 4 4 6.5 0 1.5-1 2.5-1 4 0 2 1 3 3 3 1 0 2-1 4-1Z" />
                </svg>
                {recipe.difficulty}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
