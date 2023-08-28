"use server";
import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";

interface Params {
  text: string;
  author: string;
  comunityID: string | null;
  path: string;
}

export async function createThread({ text, author, comunityID, path }: Params) {
  try {
    connectToDB();
    const createdThread = await Thread.create({
      text,
      author,
      community: null,
    });
    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id },
    });
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Error creating Thread ${error.message}`);
  }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  try {
    connectToDB();
    // if page-2 :we would skip 20 posts and start showing next posts
    const skipAmount = (pageNumber - 1) * pageSize;
    const posts = await Thread.find({
      parentID: { $in: [null, undefined] },
    })
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(pageSize)
      .populate({ path: "author", model: User })
      .populate({
        path: "children",
        populate: {
          path: "author",
          model: User,
          select: "_id name parentID image",
        },
      })
      .exec();
    const totalPostsCount = await Thread.countDocuments({
      parentID: { $in: [null, undefined] },
    });
    const isNext = totalPostsCount > skipAmount + posts.length;
    // console.log(posts)
    return { posts, isNext };
    // const posts = await postsQuery
  } catch (error: any) {
    throw new Error(`Error fetching Posts ${error.message}`);
  }
}

export async function fetchThreadById(id: string) {
  try {
    connectToDB();
    //Populate community
    const thread = await Thread.findById(id)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      })
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name parentID image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name parentID image",
            },
          },
        ],
      })
      .exec();
    return thread;
  } catch (error: any) {
    throw new Error(
      `Error fetching Thread with id ${id}. Error: ${error.message}`
    );
  }
}

export async function addCommentToThread({
  threadID,
  commentText,
  userID,
  path,
}: {
  threadID: string;
  commentText: string;
  userID: string;
  path: string;
}) {
  try {
    connectToDB();
    const originalThread = await Thread.findById(threadID);
    if (!originalThread) {
      throw new Error(`Thread not found`);
    }
    const commentThread = new Thread({
      text: commentText,
      author: userID,
      parentID: threadID,
    });
    const savedCommentThread = await commentThread.save();
    originalThread.children.push(savedCommentThread._id);
    await originalThread.save();
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Error adding comment. Error: ${error.message}`);
  }
}
