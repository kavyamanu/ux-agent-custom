import Image from "next/image";
import Link from "next/link";

const mealPlanItems = [
  {
    id: 1,
    name: "Greek Yogurt Bowl",
    day: "Monday",
    mealType: "Breakfast",
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: 2,
    name: "Mediterranean Chicken Salad",
    day: "Monday",
    mealType: "Lunch",
    image: "/placeholder.svg?height=80&width=80",
  },
];

export function MealPlan() {
  return (
    <section className="px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Meal Plan</h2>
        <Link href="/meal-plan" className="text-sm text-gray-500">
          View All
        </Link>
      </div>

      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">This Week</h3>
        <span className="text-sm text-gray-500">March 18-24</span>
      </div>

      <div className="space-y-4">
        {mealPlanItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="relative w-16 h-16 flex-shrink-0">
              <Image
                src={item.image || "/placeholder.svg"}
                alt={item.name}
                fill
                className="object-cover rounded-lg"
              />
            </div>
            <div>
              <h4 className="font-medium">{item.name}</h4>
              <p className="text-sm text-gray-500">
                {item.day} {item.mealType}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
