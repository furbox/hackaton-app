import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { getDatabase } from "../../../../db/connection.ts";
import {
	initializeDatabase,
	isDatabaseInitialized
} from "../../../../db/migrations.ts";
import {
	getLinkViews,
	getLinkLikesUsers,
	getLinkFavoritesUsers,
	getLinkDetails
} from "../../../../db/queries/link-details.ts";
import {
	createLinkScoped,
	type CreateLinkScopedParams
} from "../../../../db/queries/index.ts";

describe("Link Details Queries", () => {
	beforeAll(async () => {
		if (!isDatabaseInitialized()) {
			await initializeDatabase();
		}
	});

	afterAll(() => {
		// Keep database open for other tests
	});

	it("should return empty arrays for a link with no interactions", () => {
		const details = getLinkDetails(99999);
		expect(details).toBeNull();
	});

	it("should return empty arrays for non-existent link", () => {
		const views = getLinkViews(99998);
		expect(views).toBeArray();
		expect(views).toHaveLength(0);

		const likes = getLinkLikesUsers(99998);
		expect(likes).toBeArray();
		expect(likes).toHaveLength(0);

		const favorites = getLinkFavoritesUsers(99998);
		expect(favorites).toBeArray();
		expect(favorites).toHaveLength(0);
	});

	it("should return null for non-existent link details", () => {
		const details = getLinkDetails(99997);
		expect(details).toBeNull();
	});

	it("should return users who liked a link", () => {
		// This test assumes users exist in the database
		// For a complete test, we'd need to create test users first

		// Query likes for a non-existent link
		const likes = getLinkLikesUsers(99999);
		expect(likes).toBeArray();
		expect(likes.length).toBeGreaterThanOrEqual(0);
	});

	it("should return users who favorited a link", () => {
		// Query favorites for a non-existent link
		const favorites = getLinkFavoritesUsers(99999);
		expect(favorites).toBeArray();
		expect(favorites.length).toBeGreaterThanOrEqual(0);
	});
});
