import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';
import { responseManager } from '../response-manager.js';
import { signUpSchema, signInSchema } from '../schemas.js';

export async function signup(req: Request, res: Response) {
  console.log('user signup');

  try {
    const parsedResponse = await signUpSchema.safeParseAsync(req.body);
    if (!parsedResponse.success) {
      return res
        .status(400)
        .json({ message: 'validation error', error: parsedResponse.error });
    }

    const { username, password, name } = parsedResponse.data;

    const userFound = await prisma.user.findUnique({
      where: { username },
      select: { userId: true },
    });
    if (userFound != null) {
      return res
        .status(401)
        .send({ message: 'username taken', error: 'duplicate' });
    }

    const hashed = await Bun.password.hash(password);
    const newUser = await prisma.user.create({
      data: { username, name, password: hashed },
      select: { userId: true },
    });
    if (!newUser.userId) {
      throw new Error('userId not created');
    }

    const userId = newUser.userId;
    await responseManager.putRequest({ type: 'CREATE_USER', payload: { userId } });
    return res
      .status(201)
      .send({ message: 'user created', userId: newUser.userId });
  } catch (error) {
    return res.status(404).send({ error: 'error occured', message: error });
  }
}

export async function signin(req: Request, res: Response) {
  try {
    const parsedData = signInSchema.safeParse(req.body);

    if (!parsedData.success) {
      return res.status(400).json({
        message: 'validation error',
        error: parsedData.error,
      });
    }

    const { username, password } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { password: true, userId: true, username: true, name: true },
    });

    if (!user) {
      return res
        .status(400)
        .send({ message: 'please check your password and username' });
    }

    const match = await Bun.password.verify(password, user.password);
    if (!match) {
      return res
        .status(400)
        .send({ message: 'please check your password and username' });
    }

    const passCode = process.env.JWT_PASS;
    if (passCode === undefined) {
      console.log(' env are not loaded');
      return res.status(500).send({ message: 'internal server error' });
    }
    const token = jwt.sign({ userId: user.userId, username }, passCode, {
      expiresIn: '1d',
    });

    return res
      .status(200)
      .cookie('Authorization', token)
      .json({ message: 'successfull', username, userId: user.userId, token });
  } catch (error) {
    return res.status(404).send({ error: 'error occured', message: error });
  }
}
