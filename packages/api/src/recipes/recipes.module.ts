import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller.js';
import { RecipeService } from './recipe.service.js';
import { TheMealDbClient } from './themealdb.client.js';

// PrismaModule and RedisModule are global, so we don't import them here.
@Module({
  controllers: [RecipeController],
  providers: [RecipeService, TheMealDbClient],
  exports: [RecipeService],
})
export class RecipesModule {}
