"use client";

import { useState } from "react";
import { BottomNavigation } from "../../components/bottom-navigation";

export default function AddRecipe() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pb-16">
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

      <main className="p-4">
        <h1 className="text-2xl font-bold mb-6">Add New Recipe</h1>

        {/* Add Recipe Form */}
        <form className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Recipe Title
            </label>
            <input
              type="text"
              id="title"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Enter recipe title"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium mb-1"
            >
              Category
            </label>
            <select
              id="category"
              className="w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="">Select a category</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snacks">Snacks</option>
              <option value="desserts">Desserts</option>
              <option value="beverages">Beverages</option>
            </select>
          </div>

          <div>
            <label htmlFor="time" className="block text-sm font-medium mb-1">
              Cooking Time (minutes)
            </label>
            <input
              type="number"
              id="time"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="30"
            />
          </div>

          <div>
            <label
              htmlFor="difficulty"
              className="block text-sm font-medium mb-1"
            >
              Difficulty
            </label>
            <select
              id="difficulty"
              className="w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="">Select difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Brief description of the recipe"
            ></textarea>
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white py-3 rounded-md font-medium"
          >
            Save Recipe
          </button>
        </form>
      </main>

      <div className="fixed bottom-16 right-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        >
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
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      </div>

      <BottomNavigation />
    </div>
  );
}
