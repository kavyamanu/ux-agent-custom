import Image from "next/image";

interface FeaturedRecipeProps {
  image: string;
  title: string;
  time: string;
  difficulty: string;
}

export function FeaturedRecipe({
  image,
  title,
  time,
  difficulty,
}: FeaturedRecipeProps) {
  return (
    <div className="relative w-full h-[200px]">
      <Image
        src={image || "/placeholder.svg"}
        alt={title}
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4 text-white">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm">
          {time} | {difficulty}
        </p>
      </div>
    </div>
  );
}
