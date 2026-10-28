const Category = require("../../src/models/category");

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

    test("findById() finds category", async () => {
        const category = await Category.add("category1");
        expect(await Category.findById(category.id)).toMatchObject(category);
    });

    test("findById() returns undefined for unknown id", async () => {
        expect(await Category.findById(99999)).toBeUndefined();
    });

    test("update() renames category and returns it", async () => {
        const category = await Category.add("category1");
        const updated = await Category.update(category.id, "renamed");
        expect(updated).toEqual({ id: category.id, name: "renamed" });
        expect((await Category.findById(category.id)).name).toBe("renamed");
    });

    test("update() returns undefined for unknown id", async () => {
        expect(await Category.update(99999, "renamed")).toBeUndefined();
    });

    test("remove() returns the removed category", async () => {
        const category = await Category.add("category1");
        expect(await Category.remove(category.id)).toEqual(category);
    });

    test("remove() returns undefined for unknown id", async () => {
        expect(await Category.remove(99999)).toBeUndefined();
    });
});
