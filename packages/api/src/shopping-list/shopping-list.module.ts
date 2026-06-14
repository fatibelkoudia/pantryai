import { Module } from '@nestjs/common';
import { RecipesModule } from '../recipes/recipes.module.js';
import { ShoppingListController } from './shopping-list.controller.js';
import { ShoppingListService } from './shopping-list.service.js';

// PrismaModule is global. RecipesModule is imported for RecipeService (recipe gaps).
@Module({
  imports: [RecipesModule],
  controllers: [ShoppingListController],
  providers: [ShoppingListService],
  exports: [ShoppingListService],
})
export class ShoppingListModule {}
