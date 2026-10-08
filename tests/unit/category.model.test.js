const Category = require("../../src/models/categories");

describe("Category model", () => {
    test("category gets created successfully", async () => {
        const category = await Category.add("category1");
        expect(category).toBeDefined();
    });

    test("find() finds category", async () => {
        const category = await Category.add("category1");
        expect(await Category.find("category1")).toMatchObject(category);
    });

    test("find() returns undefined for unknown category", async () => {
        expect(await Category.find("category1")).toBeUndefined();
    });

    test("all() returns all categories", async () => {
        const category1 = await Category.add("category1");
        const category2 = await Category.add("category2");
        expect(await Category.all()).toMatchObject([category1, category2]);
    });

    test("remove() removes category", async () => {
        const category = await Category.add("category1");
        await Category.remove(category.id);
        expect(await Category.find("category1")).toBeUndefined();
    });
});
