"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";

export const updateUser = async ({
  userID,
  username,
  name,
  bio,
  image,
  path,
}: {
  userID: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}): Promise<void> => {
  try {
    connectToDB();
    await User.findOneAndUpdate(
      { id: userID },
      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
      },
      { upsert: true }
    );
    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error: any) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
};

export async function fetchUser(userID: string) {
  try {
    connectToDB();
    return await User.findOne({ id: userID });
  } catch (error: any) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
}

export async function fetchUserPosts(userID: string) {
  try {
    connectToDB();

    // TODO: Populate Community
    const threads = await User.findOne({ id: userID })
      .populate({
        path: "threads",
        model: Thread,
        populate: {
          path: "children",
          model: Thread,
          populate: {
            path: "author",
            model: User,
            select: "name image id",
          },
        },
      })
      .exec();
    return threads;
  } catch (error: any) {
    throw new Error(`Failed to fetch user posts: ${error.message}`);
  }
}

export async function fetchUsers({
  userID,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: {
  userID: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}) {
  try {
    connectToDB;
    const skipAmount = (pageNumber - 1) * pageSize;
    const regx = new RegExp(searchString, "i");
    const query: FilterQuery<typeof User> = {
      id: { $ne: userID },
    };
    if (searchString.trim() !== "") {
      query.$or = [{ username: { $regex: regx } }, { name: { $regex: regx } }];
    }
    const sortOptions = { createdAt: sortBy };
    const usersQuery = User.find(query)
      .sort(sortOptions)
      .skip(skipAmount)
      .limit(pageSize);
    const totalUsersCount = await User.countDocuments(query);
    const users = await usersQuery.exec();
    const isNext = totalUsersCount > skipAmount + users.length;

    return { users, isNext };
  } catch (error: any) {
    throw new Error(`Failed to fetch Users: ${error.message}`);
  }
}

export async function getActivity(userID: string) {
  try {
    connectToDB();
    //find all threads create dby the user
    const userThreads = await Thread.find({ author: userID });
    //Collect all the thread ids (replies) from the 'children' field
    const childThreadIds = userThreads.reduce((acc, userThread) => {
      return acc.concat(userThread.children);
    },[]);
    const replies = await Thread.find({
      _id: { $in: childThreadIds },
      author: { $ne: userID },
    }).populate({
      path: "author",
      model: User,
      select: "name image _id",
    });
    return replies;
  } catch (error: any) {
    throw new Error(`Failed to get user Activity : ${error.message}`);
  }
}
