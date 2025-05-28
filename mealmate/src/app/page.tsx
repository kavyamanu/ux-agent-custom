import { FeaturedRecipe } from "../components/featured-recipe";
import { Categories } from "../components/categories";
import { MealPlan } from "../components/meal-plan";
import { PopularRecipes } from "../components/popular-recipes";
import { BottomNavigation } from "../components/bottom-navigation";

export default function Home() {
  return (
    <main className="pb-16npm">
      <header className="flex justify-between items-center p-4 bg-white">
        <div className="text-2xl font-bold italic">logo</div>
        <div className="flex gap-4">
          <button aria-label="Search">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-search"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
          <button aria-label="Profile">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-user"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </header>

      <FeaturedRecipe
        image="/placeholder.svg?height=300&width=600"
        title="Pan-seared salmon with spring vegetables"
        time="30 mins"
        difficulty="Medium"
      />

      <Categories />

      <MealPlan />

      <PopularRecipes />

      <BottomNavigation />
    </main>
  );
}
